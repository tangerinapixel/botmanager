// backend/services/ai/aiMemoryRepository.js
// Camada de persistência autônoma, eficiente e isolada para histórico e perfil de contatos.

const fs = require('fs');
const path = require('path');
const { dataDir } = require('../../utils/paths');

const CONVERSATIONS_DIR = path.join(dataDir, 'conversations');
const MAX_STORED_TURNS = 30; // Guarda até 30 mensagens em disco por contato
const WRITE_DEBOUNCE_MS = 1500; // Debounce de escrita em disco para economizar I/O

// Cache em memória para acesso ultrarrápido durante conversas ativas
const memoryCache = new Map();
const pendingWrites = new Map();
const RAM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de inatividade descarrega da RAM (dados permanecem 100% no disco)

// Faxina periódica leve a cada 15 minutos (unref para não reter encerramento do processo)
const ramCleanupInterval = setInterval(() => {
  const agora = Date.now();
  for (const [jid, session] of memoryCache.entries()) {
    if (!pendingWrites.has(jid) && session.lastSeen && (agora - session.lastSeen > RAM_CACHE_TTL_MS)) {
      memoryCache.delete(jid);
    }
  }
}, 15 * 60 * 1000);
if (ramCleanupInterval.unref) ramCleanupInterval.unref();

/**
 * Garante que a pasta de conversas exista no disco
 */
function ensureStorageDir() {
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[AIMemoryRepository] Erro ao criar diretório de conversas:', err.message);
  }
}

/**
 * Sanitiza o identificador do WhatsApp (JID) para um nome seguro de arquivo no sistema operacional
 */
function sanitizeJid(jid) {
  if (!jid || typeof jid !== 'string') return 'unknown_contact';
  return jid.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getFilePath(jid) {
  return path.join(CONVERSATIONS_DIR, `${sanitizeJid(jid)}.json`);
}

/**
 * Salva a sessão no disco de forma assíncrona com debounce para não bloquear o loop de eventos
 */
function scheduleDiskSave(jid) {
  if (pendingWrites.has(jid)) {
    clearTimeout(pendingWrites.get(jid));
  }

  const timer = setTimeout(() => {
    pendingWrites.delete(jid);
    const session = memoryCache.get(jid);
    if (!session) return;

    try {
      ensureStorageDir();
      const filePath = getFilePath(jid);
      const dataStr = JSON.stringify(session, null, 2);
      fs.writeFile(filePath, dataStr, 'utf8', (err) => {
        if (err) {
          console.error(`[AIMemoryRepository] Falha ao salvar conversa de ${jid}:`, err.message);
        }
      });
    } catch (err) {
      console.error(`[AIMemoryRepository] Erro inesperado ao agendar salvamento de ${jid}:`, err.message);
    }
  }, WRITE_DEBOUNCE_MS);

  if (timer.unref) timer.unref();
  pendingWrites.set(jid, timer);
}

/**
 * Força a gravação síncrona imediata (útil em encerramento do processo)
 */
function flushPendingWritesSync() {
  for (const [jid, timer] of pendingWrites.entries()) {
    clearTimeout(timer);
    const session = memoryCache.get(jid);
    if (session) {
      try {
        ensureStorageDir();
        fs.writeFileSync(getFilePath(jid), JSON.stringify(session, null, 2), 'utf8');
      } catch (_) {}
    }
  }
  pendingWrites.clear();
}

/**
 * Obtém ou inicializa a sessão completa de um contato a partir do disco ou cache
 */
function getContactSession(jid, contactInfo = {}) {
  if (!jid) return null;

  if (memoryCache.has(jid)) {
    const session = memoryCache.get(jid);
    if (contactInfo.name && (!session.name || session.name === 'Amigo(a)')) {
      session.name = contactInfo.name;
    }
    return session;
  }

  ensureStorageDir();
  const filePath = getFilePath(jid);
  let session = null;

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      session = JSON.parse(content);
    } catch (err) {
      console.warn(`[AIMemoryRepository] Arquivo corrompido para ${jid}, recriando sessão limpa:`, err.message);
    }
  }

  if (!session || !Array.isArray(session.turns)) {
    session = {
      jid,
      name: contactInfo.name || contactInfo.pushname || '',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      totalMessages: 0,
      metadata: {
        jaRecebeuBoasVindas: false,
        jaRecebeuLinkGrupo: false,
        topicosInteresse: [],
        resumo: ''
      },
      turns: []
    };
  } else {
    if (contactInfo.name && (!session.name || session.name === 'Amigo(a)')) {
      session.name = contactInfo.name;
    }
  }

  memoryCache.set(jid, session);
  return session;
}

/**
 * Consulta a sessão de um contato apenas se ela já existir no cache ou no disco.
 * NÃO instancia nova sessão vazia nem polui o cache com Date.now().
 * @param {string} jid 
 * @returns {Object|null}
 */
function findContactSession(jid) {
  if (!jid || typeof jid !== 'string') return null;

  if (memoryCache.has(jid)) {
    return memoryCache.get(jid);
  }

  ensureStorageDir();
  const filePath = getFilePath(jid);

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const session = JSON.parse(content);
      if (session && Array.isArray(session.turns)) {
        memoryCache.set(jid, session);
        return session;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Registra um novo turno (mensagem do usuário ou resposta da IA)
 */
function addMessageTurn(jid, role, text, contactInfo = {}) {
  if (!jid || !text || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (!cleanText) return null;

  const session = getContactSession(jid, contactInfo);
  if (!session) return null;

  const now = Date.now();
  session.lastSeen = now;
  session.totalMessages = (session.totalMessages || 0) + 1;

  if (contactInfo.name && !session.name) {
    session.name = contactInfo.name;
  }

  // Agrupa mensagens consecutivas do mesmo remetente em curto intervalo (<20 segundos)
  const lastTurn = session.turns[session.turns.length - 1];
  if (lastTurn && lastTurn.role === role && (now - (lastTurn.timestamp || 0) < 20000)) {
    if (!lastTurn.text.includes(cleanText)) {
      lastTurn.text += '\n' + cleanText;
      lastTurn.timestamp = now;
    }
  } else {
    session.turns.push({
      role: role === 'model' || role === 'assistant' ? 'model' : 'user',
      text: cleanText,
      timestamp: now
    });
  }

  // Limita o histórico salvo para evitar arquivos gigantescos
  if (session.turns.length > MAX_STORED_TURNS) {
    session.turns = session.turns.slice(-MAX_STORED_TURNS);
  }

  scheduleDiskSave(jid);
  return session;
}

/**
 * Retorna o histórico formatado rigorosamente de acordo com os requisitos da API Gemini:
 * - Alternância user/model
 * - Primeiro turno SEMPRE user
 * - Último turno SEMPRE user (a pergunta/mensagem atual)
 */
function getFormattedGeminiHistory(jid, currentMessageText, maxTurns = 12) {
  const session = getContactSession(jid);
  const turns = session && Array.isArray(session.turns) ? [...session.turns] : [];

  // Se houver mensagem atual e ela ainda não estiver registrada no histórico
  if (currentMessageText && typeof currentMessageText === 'string') {
    const cleanCurrent = currentMessageText.trim();
    const last = turns[turns.length - 1];
    if (!last || last.role !== 'user' || !last.text.includes(cleanCurrent)) {
      turns.push({ role: 'user', text: cleanCurrent, timestamp: Date.now() });
    }
  }

  // Janela deslizante dos últimos turnos
  const recentTurns = turns.slice(-maxTurns);

  // 1. Consolida turnos consecutivos do mesmo role
  const consolidated = [];
  for (const t of recentTurns) {
    const prev = consolidated[consolidated.length - 1];
    if (prev && prev.role === t.role) {
      prev.text += '\n' + t.text;
    } else {
      consolidated.push({ role: t.role, text: t.text });
    }
  }

  // 2. Garante que o primeiro turno seja 'user'
  while (consolidated.length > 0 && consolidated[0].role !== 'user') {
    consolidated.shift();
  }

  // 3. Garante que o último turno seja 'user'
  if (consolidated.length > 0 && consolidated[consolidated.length - 1].role !== 'user') {
    if (currentMessageText) {
      consolidated.push({ role: 'user', text: currentMessageText.trim() });
    }
  }

  // Se ainda estiver vazio, cria o turno inicial do usuário
  if (consolidated.length === 0 && currentMessageText) {
    consolidated.push({ role: 'user', text: currentMessageText.trim() });
  }

  // 4. Mapeia para o formato de contents da Google Generative AI
  return consolidated.map(t => ({
    role: t.role,
    parts: [{ text: t.text }]
  }));
}

/**
 * Atualiza metadados cognitivos do contato (ex: links já enviados, preferências)
 */
function updateContactMetadata(jid, updates = {}) {
  const session = getContactSession(jid);
  if (!session) return false;

  session.metadata = {
    ...(session.metadata || {}),
    ...updates
  };

  scheduleDiskSave(jid);
  return true;
}

/**
 * Limpa o histórico de um contato específico
 */
function clearContactSession(jid) {
  if (!jid) return false;
  memoryCache.delete(jid);
  if (pendingWrites.has(jid)) {
    clearTimeout(pendingWrites.get(jid));
    pendingWrites.delete(jid);
  }
  const filePath = getFilePath(jid);
  try {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Se estiver bloqueado por I/O em andamento no Windows, sobrescreve limpo
        fs.writeFileSync(filePath, '{}', 'utf8');
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  getContactSession,
  findContactSession,
  addMessageTurn,
  getFormattedGeminiHistory,
  updateContactMetadata,
  clearContactSession,
  flushPendingWritesSync
};
