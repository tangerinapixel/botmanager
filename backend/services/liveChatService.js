const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { formatPhoneNumber, ts } = require('../utils/logger');
const { getContactSession, findContactSession, addMessageTurn } = require('./ai/aiMemoryRepository');
const WWebJSPatcher = require('../utils/wwebjsPatcher');

/**
 * Valida se um nome é nulo, vazio ou o placeholder genérico de desconhecido do WhatsApp Web
 */
function isUnknownName(str) {
  if (!str || typeof str !== 'string') return true;
  const lower = str.trim().toLowerCase();
  return lower === '' ||
         lower === 'desconhecido' ||
         lower === 'desconhecida' ||
         lower === 'unknown' ||
         lower === 'null' ||
         lower === 'undefined';
}

// Tipos de mensagem de protocolo e notificações internas do WhatsApp Web que nunca devem ser renderizados
const SYSTEM_MESSAGE_TYPES = new Set([
  'e2e_notification',
  'notification_template',
  'ciphertext',
  'protocol',
  'gp2',
  'broadcast_notification',
  'call_log',
  'revoked',
]);

// Tipos de mídia válidos que devem ser preservados mesmo quando o corpo (legenda) for vazio
const VALID_MEDIA_TYPES = new Set([
  'image',
  'video',
  'audio',
  'ptt',
  'document',
  'sticker',
  'location',
  'vcard',
  'multi_vcard',
]);

/**
 * Valida se uma mensagem do WhatsApp Web é renderizável e legítima.
 * Rejeita mensagens da lista negra de sistema e mensagens sem texto e sem mídia.
 */
function isRenderableMessage(m) {
  if (!m) return false;
  const type = m.type || 'chat';
  if (SYSTEM_MESSAGE_TYPES.has(type)) {
    return false;
  }
  const isMedia = Boolean(m.hasMedia || VALID_MEDIA_TYPES.has(type));
  const hasText = Boolean(typeof m.body === 'string' && m.body.trim().length > 0);
  return isMedia || hasText;
}

// Cache em memória de fotos de perfil com TTL de 2 horas (evita chamadas redundantes ao WhatsApp Web)
const avatarCache = new Map();
const AVATAR_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// Diretório para cache persistente de mídias do Live Chat (evita chamadas repetidas ao CDP/Puppeteer)
const mediaCacheDir = path.join(__dirname, '..', 'data', 'media_cache');
try {
  if (!fs.existsSync(mediaCacheDir)) {
    fs.mkdirSync(mediaCacheDir, { recursive: true });
  }
} catch (_) {}

/**
 * Higieniza o identificador da mensagem para uso seguro no sistema de arquivos
 */
function sanitizeMessageId(msgId) {
  return String(msgId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Limpa arquivos em media_cache/ mais antigos que 7 dias ou mantém no máximo 200 mais recentes
 */
async function pruneMediaCache() {
  try {
    if (!fs.existsSync(mediaCacheDir)) return;
    const files = await fs.promises.readdir(mediaCacheDir);
    if (files.length === 0) return;

    const now = Date.now();
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const MAX_FILES = 200;

    const fileStats = [];
    for (const f of files) {
      const fp = path.join(mediaCacheDir, f);
      try {
        const st = await fs.promises.stat(fp);
        if (now - st.mtimeMs > MAX_AGE_MS) {
          await fs.promises.unlink(fp).catch(() => {});
        } else {
          fileStats.push({ path: fp, mtime: st.mtimeMs });
        }
      } catch (_) {}
    }

    if (fileStats.length > MAX_FILES) {
      fileStats.sort((a, b) => b.mtime - a.mtime);
      const toRemove = fileStats.slice(MAX_FILES);
      for (const item of toRemove) {
        await fs.promises.unlink(item.path).catch(() => {});
      }
    }
  } catch (_) {}
}

// Dispara limpeza periódica sem bloquear inicialização
setTimeout(() => { pruneMediaCache().catch(() => {}); }, 15000);

class LiveChatService {
  /**
   * Obtém a URL da foto de perfil de um contato ou grupo com cache em memória RAM.
   * @param {Object} clientManager 
   * @param {string} jid 
   * @returns {Promise<string|null>}
   */
  async getContactAvatar(clientManager, jid) {
    if (!jid || typeof jid !== 'string') return null;

    const cached = avatarCache.get(jid);
    if (cached && (Date.now() - cached.timestamp < AVATAR_CACHE_TTL_MS)) {
      return cached.url;
    }

    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      return null;
    }

    try {
      // Timeout defensivo de 2.5s para nunca bloquear o backend
      const fetchPromise = client.getProfilePicUrl(jid);
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2500));
      const picUrl = await Promise.race([fetchPromise, timeoutPromise]).catch(() => null);

      const finalUrl = (typeof picUrl === 'string' && picUrl.startsWith('http')) ? picUrl : null;
      avatarCache.set(jid, { url: finalUrl, timestamp: Date.now() });
      return finalUrl;
    } catch (_) {
      avatarCache.set(jid, { url: null, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Obtém a lista de chats privados do WhatsApp ordenados por atividade recente.
   * @param {Object} clientManager 
   */
  async getRecentChats(clientManager) {
    if (!clientManager) {
      return { ready: false, chats: [] };
    }

    const client = typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      return { ready: false, chats: [] };
    }

    // Validação de estado real: reconhece prontidão se o bot estiver 'READY' ou tiver client.info ativo
    const isReady = (clientManager.waClientState === 'READY') || Boolean(client.info);
    if (!isReady) {
      return { ready: false, chats: [] };
    }

    try {
      await WWebJSPatcher.applyChatsPatch(client);
      let rawChats = [];
      try {
        rawChats = await client.getChats();
      } catch (chatFetchErr) {
        console.warn(`[${ts()}] [LiveChatService] Aviso ao invocar client.getChats, usando fallback resiliente:`, chatFetchErr.message);
        rawChats = [];
      }
      if (!Array.isArray(rawChats)) {
        rawChats = [];
      }

      // Filtra conversas válidas: individuais privadas (@c.us, @lid) e grupos (@g.us)
      // Ignora estritamente broadcasts, newsletters, status, contêineres-pai de comunidade e grupos órfãos
      const validChats = rawChats.filter(c => {
        if (!c || !c.id || typeof c.id._serialized !== 'string') return false;
        const jid = c.id._serialized;

        // 1. Rejeita broadcasts, newsletters e canais
        if (c.isBroadcast ||
            jid.endsWith('@broadcast') ||
            jid.endsWith('@newsletter') ||
            jid === 'status@broadcast' ||
            jid === '0@c.us' ||
            jid.startsWith('0@')) {
          return false;
        }

        const isGroup = Boolean(c.isGroup || jid.endsWith('@g.us'));

        // 2. Descarte de Contêineres-Pai de Comunidade (não são salas de conversas, apenas agrupadores)
        const isParentGroup = Boolean(
          c.isParentGroup ||
          c._data?.isParentGroup ||
          c.groupMetadata?.isParentGroup ||
          c.groupType === 'COMMUNITY' ||
          c.groupMetadata?.groupType === 'COMMUNITY'
        );
        if (isGroup && isParentGroup) {
          return false;
        }

        // 3. Descarte de registros órfãos de grupos sem nome resolvido e inativos/readOnly (históricos antigos de chamada/gp2)
        if (isGroup) {
          const rawName = (c.name || c.formattedTitle || c.contact?.name || c.contact?.pushname || '').trim();
          const isGenericName = !rawName || isUnknownName(rawName) || rawName.toLowerCase() === 'grupo';
          const isReadOnly = Boolean(c.isReadOnly);
          const hasNoLastMessage = !c.lastMessage || (!c.lastMessage.body && !c.lastMessage.type);
          if (isGenericName && (isReadOnly || hasNoLastMessage)) {
            return false;
          }
        }

        return true;
      });

      // Mapeia para um formato limpo, leve e robusto para o frontend
      const mappedChats = validChats.map(c => {
        const jid = c.id._serialized;
        const isGroup = Boolean(c.isGroup || jid.endsWith('@g.us'));
        const isCommunity = Boolean(
          c.isParentGroup ||
          c.isCommunity ||
          c.isCommunityAnnouncementGroup ||
          c._data?.isParentGroup ||
          c._data?.isCommunity ||
          c.groupMetadata?.groupType === 'COMMUNITY' ||
          c.groupMetadata?.groupType === 'LINKED_ANNOUNCEMENT_GROUP'
        );
        const number = isGroup ? '' : (c.id.user || jid.replace(/@c\.us$/, '').replace(/@lid$/, ''));
        let participantsCount = 0;
        if (isGroup) {
          try {
            if (Array.isArray(c.groupMetadata?.participants)) {
              participantsCount = c.groupMetadata.participants.length;
            } else if (Array.isArray(c._data?.groupMetadata?.participants)) {
              participantsCount = c._data.groupMetadata.participants.length;
            } else if (c.groupMetadata && c.participants) {
              participantsCount = c.participants.length;
            }
          } catch (_) {
            participantsCount = 0;
          }
        }
        const phoneFormatted = isGroup
          ? (participantsCount > 0 ? `${participantsCount} participantes` : (isCommunity ? 'Comunidade' : 'Grupo'))
          : formatPhoneNumber(jid);

        // Consulta sessão local apenas para contatos individuais (não-mutante, sem Date.now())
        const localSession = !isGroup ? findContactSession(jid) : null;

        // Resolução inteligente de nome: elimina estritamente o rótulo "Desconhecido"
        let name = '';
        if (isGroup) {
          name = (!isUnknownName(c.name) && c.name) ||
                 (!isUnknownName(c.formattedTitle) && c.formattedTitle) ||
                 (!isUnknownName(c.contact?.name) && c.contact.name) ||
                 (!isUnknownName(c.contact?.pushname) && c.contact.pushname) ||
                 (isCommunity ? 'Comunidade' : 'Grupo');
        } else {
          if (!isUnknownName(c.name)) {
            name = c.name.trim();
          } else if (!isUnknownName(c.formattedTitle)) {
            name = c.formattedTitle.trim();
          } else if (localSession && !isUnknownName(localSession.name) && localSession.name !== 'Amigo(a)') {
            name = localSession.name.trim();
          } else if (!isUnknownName(c.pushname)) {
            name = c.pushname.trim();
          } else if (!isUnknownName(c._data?.notifyName)) {
            name = c._data.notifyName.trim();
          } else if (!isUnknownName(c.contact?.pushname)) {
            name = c.contact.pushname.trim();
          } else {
            name = phoneFormatted || (number ? `+${number}` : jid);
          }
        }

        let lastMsgBody = '';
        let lastMsgFromMe = false;
        let lastMsgAuthor = '';

        if (c.lastMessage) {
          lastMsgBody = typeof c.lastMessage.body === 'string' ? c.lastMessage.body : '';
          lastMsgFromMe = Boolean(c.lastMessage.fromMe);
          lastMsgAuthor = c.lastMessage.author || '';
        } else if (localSession && Array.isArray(localSession.turns) && localSession.turns.length > 0) {
          // Fallback para último turno local se WhatsApp Web não tiver lastMessage em RAM
          const lastTurn = localSession.turns[localSession.turns.length - 1];
          if (lastTurn && typeof lastTurn.text === 'string') {
            lastMsgBody = lastTurn.text;
            lastMsgFromMe = lastTurn.role === 'model' || lastTurn.role === 'assistant';
          }
        }

        // Cálculo rigoroso e fiel de timestamp:
        // Prioriza o maior carimbo Unix nativo (chat.t em segundos ou lastMessage.timestamp em segundos)
        const chatTimestampSec = Number(c.timestamp || 0);
        const lastMsgTimestampSec = Number(c.lastMessage?.timestamp || 0);
        let bestTimeMs = Math.max(chatTimestampSec, lastMsgTimestampSec) * 1000;

        // Se ambos forem 0 e houver histórico local com turnos reais, recupera o timestamp da última mensagem
        if (bestTimeMs <= 0 && localSession && Array.isArray(localSession.turns) && localSession.turns.length > 0) {
          const lastTurn = localSession.turns[localSession.turns.length - 1];
          if (lastTurn && Number(lastTurn.timestamp) > 0) {
            bestTimeMs = Number(lastTurn.timestamp);
          }
        }

        // Chats sem qualquer atividade permanecem com timestamp 0 (fim da lista). NUNCA Date.now()!
        const finalTimestamp = bestTimeMs > 0 ? bestTimeMs : 0;

        const cachedAvatar = avatarCache.get(jid);
        const avatarUrl = (cachedAvatar && (Date.now() - cachedAvatar.timestamp < AVATAR_CACHE_TTL_MS))
          ? cachedAvatar.url
          : null;

        return {
          jid,
          name,
          number,
          phoneFormatted,
          avatarUrl,
          isGroup,
          isCommunity,
          unreadCount: c.unreadCount || 0,
          timestamp: finalTimestamp,
          lastMessage: lastMsgBody,
          lastMsgFromMe,
          lastMsgAuthor,
          isPinned: Boolean(c.pinned),
        };
      });

      // Segregação de Pools: Conversas Privadas vs Grupos e Comunidades
      // Garante que grupos/comunidades nunca sejam descartados pela rotatividade de leads privados
      const directChats = [];
      const groupChats = [];

      for (const chat of mappedChats) {
        if (chat.isGroup) {
          groupChats.push(chat);
        } else {
          directChats.push(chat);
        }
      }

      // Ordena conversas privadas: Pinned primeiro, depois por atividade recente decrescente
      directChats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.timestamp - a.timestamp;
      });

      // Ordena grupos e comunidades: Pinned primeiro, depois por atividade recente; desempata por nome
      groupChats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
        return (a.name || '').localeCompare(b.name || '');
      });

      // Limita conversas privadas às 100 mais recentes para agilidade de resposta,
      // preservando integralmente TODOS os grupos e comunidades do operador
      const limitedDirect = directChats.slice(0, 100);
      const combined = [...limitedDirect, ...groupChats];

      // Ordenação final para a visão geral unificada (aba "Todas"):
      // Pinned primeiro; em seguida, ordenação decrescente por timestamp
      combined.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return b.timestamp - a.timestamp;
      });

      return { ready: true, chats: combined };
    } catch (err) {
      console.error(`[LiveChatService] Erro ao listar conversas:`, err.message);
      return { ready: false, error: err.message, chats: [] };
    }
  }

  /**
   * Obtém o histórico de mensagens de uma conversa específica (privada ou grupo).
   * @param {Object} clientManager 
   * @param {string} jid 
   * @param {number} limit 
   */
  async getChatMessages(clientManager, jid, limit = 50) {
    if (!jid || typeof jid !== 'string') {
      throw new Error('JID de contato inválido.');
    }

    if (jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) {
      throw new Error('Operação permitida apenas para conversas privadas ou grupos.');
    }

    const isGroup = jid.endsWith('@g.us');
    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    let messages = [];
    let chatObj = null;

    // 1. Tenta buscar mensagens diretamente do WhatsApp Web se estiver pronto
    if (client && client.pupPage && !client.pupPage.isClosed()) {
      try {
        await WWebJSPatcher.applyChatsPatch(client);
        chatObj = await client.getChatById(jid);
        if (chatObj) {
          const rawMessages = await chatObj.fetchMessages({ limit: Math.min(limit, 100) });
          const filteredRaw = (Array.isArray(rawMessages) ? rawMessages : []).filter(isRenderableMessage);
          messages = filteredRaw.map(m => {
            const authorJid = m?.author || '';
            const rawNotify = m?._data?.notifyName || '';
            const authorName = !isUnknownName(rawNotify) ? rawNotify : (authorJid ? formatPhoneNumber(authorJid) : '');

            const serializedId = (m && m.id && (m.id._serialized || m.id.id)) || String((m && m.timestamp) || Date.now());
            const hasMedia = Boolean(m?.hasMedia || m?.type === 'image' || m?.type === 'sticker');
            const isVisualMedia = Boolean(hasMedia && (m?.type === 'image' || m?.type === 'sticker'));

            return {
              id: serializedId,
              from: m?.from || '',
              to: m?.to || '',
              author: authorJid,
              authorName: authorName,
              fromMe: Boolean(m?.fromMe),
              body: m?.body || '',
              type: m?.type || 'chat',
              timestamp: ((m && m.timestamp) || 0) * 1000,
              hasMedia: hasMedia,
              mediaUrl: isVisualMedia ? `/api/live-chat/media/${encodeURIComponent(jid)}/${encodeURIComponent(serializedId)}` : null,
              isGroup,
            };
          });

          // Marca como lida no celular quando o operador abre o chat, EXCETO se houver mensagem recebida
          // ainda sem resposta (última mensagem do cliente): o Deep Scan usa unreadCount > 0 para localizar
          // pendências, então zerar aqui faria o bot nunca responder essa conversa. O próprio envio de uma
          // resposta (bot ou operador) já marca a conversa como lida no WhatsApp.
          // Grupos são sempre marcados (o bot jamais responde grupos).
          const lastRawMsg = filteredRaw.reduce((latest, m) => {
            if (!m) return latest;
            if (!latest || (Number(m.timestamp) || 0) >= (Number(latest.timestamp) || 0)) return m;
            return latest;
          }, null);
          const hasPendingIncoming = Boolean(lastRawMsg && !lastRawMsg.fromMe);
          if (isGroup || !hasPendingIncoming) {
            chatObj.sendSeen().catch(() => {});
          }
        }
      } catch (waErr) {
        console.warn(`[LiveChatService] Erro ao buscar mensagens via WhatsApp Web para ${jid}: ${waErr.message}.`);
      }
    }

    // 2. Fallback local: Se for contato privado e sem mensagens do WA, consulta aiMemoryRepository
    if (messages.length === 0 && !isGroup) {
      try {
        const session = findContactSession(jid);
        if (session && Array.isArray(session.turns)) {
          messages = session.turns.map((t, idx) => ({
            id: `local_${t.timestamp || idx}`,
            from: t.role === 'user' ? jid : 'me',
            to: t.role === 'user' ? 'me' : jid,
            author: '',
            authorName: '',
            fromMe: t.role === 'model' || t.role === 'assistant',
            body: t.text || '',
            type: 'chat',
            timestamp: t.timestamp || 0,
            hasMedia: false,
            isGroup: false,
          }));
        }
      } catch (_) {}
    }

    // Ordena mensagens em ordem cronológica (antigas para as mais recentes)
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Resolve o nome limpo do chat para o cabeçalho
    let chatName = isGroup ? 'Grupo' : formatPhoneNumber(jid);
    try {
      if (chatObj) {
        if (!isUnknownName(chatObj.name)) chatName = chatObj.name.trim();
        else if (!isUnknownName(chatObj.formattedTitle)) chatName = chatObj.formattedTitle.trim();
      } else if (client && client.pupPage && !client.pupPage.isClosed()) {
        const fetched = await client.getChatById(jid).catch(() => null);
        if (fetched) {
          if (!isUnknownName(fetched.name)) chatName = fetched.name.trim();
          else if (!isUnknownName(fetched.formattedTitle)) chatName = fetched.formattedTitle.trim();
        }
      }
      if (isUnknownName(chatName)) {
        const session = findContactSession(jid);
        if (session && !isUnknownName(session.name) && session.name !== 'Amigo(a)') {
          chatName = session.name.trim();
        } else {
          chatName = formatPhoneNumber(jid);
        }
      }
    } catch (_) {}

    // Busca a foto de perfil do contato em paralelo ou do cache
    const avatarUrl = await this.getContactAvatar(clientManager, jid).catch(() => null);

    return {
      jid,
      name: chatName,
      phoneFormatted: isGroup ? 'Grupo' : formatPhoneNumber(jid),
      avatarUrl,
      isGroup,
      messages,
    };
  }

  /**
   * Envia uma mensagem em tempo real para o contato ou grupo especificado.
   * Suporta texto e/ou arquivo de imagem anexado (MessageMedia).
   * @param {Object} clientManager 
   * @param {string} jid 
   * @param {string} text 
   * @param {Object} io 
   * @param {Object|null} file - Objeto Multer do arquivo enviado (opcional)
   */
  async sendMessage(clientManager, jid, text, io = null, file = null) {
    if (!jid || typeof jid !== 'string') {
      throw new Error('JID de contato ou grupo inválido.');
    }

    const cleanText = (text || '').trim();
    const hasImageFile = Boolean(file && file.path && fs.existsSync(file.path));

    if (!cleanText && !hasImageFile) {
      throw new Error('É necessário fornecer um texto ou uma imagem para envio.');
    }

    // Normaliza o JID para garantir domínio válido
    const targetJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@c.us`;

    if (targetJid.endsWith('@broadcast') || targetJid.endsWith('@newsletter')) {
      throw new Error('Envio permitido apenas para conversas privadas ou grupos.');
    }

    const isGroup = targetJid.endsWith('@g.us');
    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      throw new Error('WhatsApp Client não está conectado ou pronto para envio.');
    }

    const timestamp = ts();
    console.log(`[${timestamp}] [LiveChat] Enviando mensagem manual para ${targetJid}: "${cleanText.substring(0, 30)}..." (com imagem: ${hasImageFile})`);

    // Envia diretamente via WhatsApp Web
    let sentMsg = null;
    try {
      await WWebJSPatcher.applyChatsPatch(client);
      if (hasImageFile) {
        const media = MessageMedia.fromFilePath(path.resolve(file.path));
        sentMsg = await client.sendMessage(targetJid, media, {
          caption: cleanText || undefined,
          sendSeen: false
        });
      } else {
        sentMsg = await client.sendMessage(targetJid, cleanText);
      }
    } catch (sendErr) {
      console.error(`[LiveChat] Erro no client.sendMessage para ${targetJid}:`, sendErr.message);
      // Remove arquivo temporário se houver falha
      if (hasImageFile) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
      throw new Error(`Falha no envio via WhatsApp: ${sendErr.message}`);
    }

    // Proteção defensiva: sentMsg pode ser undefined dependendo da versão do WWebJS
    const msgId = (sentMsg && sentMsg.id && (sentMsg.id._serialized || sentMsg.id.id)) || `${targetJid}_${Date.now()}`;
    const msgTimestamp = Date.now();

    // Cache inteligente de envio: move/copia o arquivo enviado diretamente para media_cache
    let mediaUrl = null;
    if (hasImageFile) {
      try {
        const sanitized = sanitizeMessageId(msgId);
        const ext = path.extname(file.originalname || file.path) || '.jpg';
        const cachedPath = path.join(mediaCacheDir, `${sanitized}${ext}`);
        fs.copyFileSync(file.path, cachedPath);
        fs.unlinkSync(file.path); // Limpa o temporário da pasta uploads
        mediaUrl = `/api/live-chat/media/${encodeURIComponent(targetJid)}/${encodeURIComponent(msgId)}`;
      } catch (cacheErr) {
        console.warn(`[LiveChat] Aviso ao mover imagem enviada para o media_cache: ${cacheErr.message}`);
      }
    }

    // Salva no repositório de memória local apenas para contatos privados
    if (!isGroup) {
      try {
        addMessageTurn(targetJid, 'model', cleanText || '[Imagem enviada]', { name: '' });
      } catch (_) {}
    }

    // Transmite evento em tempo real via Socket.IO
    if (io) {
      io.emit('live-chat:new-message', {
        jid: targetJid,
        message: {
          id: msgId,
          from: 'me',
          to: targetJid,
          author: '',
          authorName: 'Você',
          fromMe: true,
          body: cleanText,
          type: hasImageFile ? 'image' : 'chat',
          hasMedia: hasImageFile,
          mediaUrl: mediaUrl,
          timestamp: msgTimestamp,
          isGroup,
        }
      });

      io.emit('system-log', {
        id: Date.now(),
        type: 'info',
        action: hasImageFile ? 'Imagem Enviada (Operador)' : 'Mensagem Enviada (Operador)',
        message: `Para ${isGroup ? 'Grupo' : formatPhoneNumber(targetJid)}: ${hasImageFile ? '📷 [Imagem]' : ''} "${cleanText.length > 35 ? cleanText.substring(0, 35) + '…' : cleanText}"`,
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      messageId: msgId,
      timestamp: msgTimestamp,
      hasMedia: hasImageFile,
      mediaUrl
    };
  }

  /**
   * Apaga uma mensagem enviada (para todos ou localmente).
   * @param {Object} clientManager 
   * @param {string} jid 
   * @param {string} messageId 
   * @param {boolean} everyone 
   * @param {Object} io 
   */
  async deleteMessage(clientManager, jid, messageId, everyone = true, io = null) {
    if (!messageId || typeof messageId !== 'string') {
      throw new Error('ID da mensagem é obrigatório para exclusão.');
    }
    const cleanJid = (jid || '').trim();

    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      throw new Error('WhatsApp Client não está conectado ou pronto para exclusão.');
    }

    const timestamp = ts();
    console.log(`[${timestamp}] [LiveChat] Solicitando exclusão da mensagem ${messageId} (everyone: ${everyone})...`);

    let msg = null;
    try {
      msg = await client.getMessageById(messageId);
    } catch (findErr) {
      console.warn(`[${timestamp}] [LiveChat] getMessageById falhou: ${findErr.message}. Tentando via evaluate...`);
    }

    if (msg && typeof msg.delete === 'function') {
      try {
        await msg.delete(Boolean(everyone));
      } catch (delErr) {
        console.error(`[LiveChat] Erro no msg.delete: ${delErr.message}`);
        throw new Error(`Falha ao apagar mensagem no WhatsApp: ${delErr.message}`);
      }
    } else {
      // Fallback via evaluate direto na página
      const evalResult = await client.pupPage.evaluate(async (msgId, isEveryone) => {
        try {
          const collections = window.require('WAWebCollections');
          const targetMsg = collections.Msg.get(msgId) ||
                            (await collections.Msg.getMessagesById([msgId]))?.messages?.[0];
          if (!targetMsg) return { success: false, error: 'Mensagem não encontrada na memória do WhatsApp.' };

          const chat = collections.Chat.get(targetMsg.id.remote) ||
                       (await collections.Chat.find(targetMsg.id.remote));
          if (!chat) return { success: false, error: 'Chat da mensagem não encontrado.' };

          const canRevoke = window.require('WAWebMsgActionCapability').canSenderRevokeMsg(targetMsg) ||
                            window.require('WAWebMsgActionCapability').canAdminRevokeMsg(targetMsg);
          const { Cmd } = window.require('WAWebCmd');

          if (isEveryone && canRevoke) {
            await (window.WWebJS && window.WWebJS.compareWwebVersions && window.WWebJS.compareWwebVersions(window.Debug.VERSION, '>=', '2.3000.0')
              ? Cmd.sendRevokeMsgs(chat, { list: [targetMsg], type: 'message' }, { clearMedia: true })
              : Cmd.sendRevokeMsgs(chat, [targetMsg], { clearMedia: true, type: targetMsg.id.fromMe ? 'Sender' : 'Admin' }));
            return { success: true };
          } else if (isEveryone && !canRevoke) {
            return { success: false, error: 'O WhatsApp não autorizou apagar para todos (tempo limite de ~60h excedido).' };
          } else {
            await Cmd.sendDeleteMsgs(chat, [targetMsg], true);
            return { success: true };
          }
        } catch (e) {
          return { success: false, error: e.message || 'Erro ao deletar mensagem.' };
        }
      }, messageId, everyone);

      if (!evalResult.success) {
        throw new Error(evalResult.error || 'Não foi possível apagar a mensagem.');
      }
    }

    if (io) {
      io.emit('live-chat:message-deleted', {
        jid: cleanJid,
        messageId,
        everyone: Boolean(everyone),
        timestamp: Date.now()
      });

      io.emit('system-log', {
        id: Date.now(),
        type: 'info',
        action: 'Mensagem Apagada',
        message: `Mensagem apagada com sucesso (${everyone ? 'para todos' : 'para mim'}).`,
        timestamp: new Date().toISOString()
      });
    }

    return { success: true, messageId };
  }

  /**
   * Edita uma mensagem enviada (se estiver dentro da janela de 15 minutos).
   * @param {Object} clientManager 
   * @param {string} jid 
   * @param {string} messageId 
   * @param {string} newText 
   * @param {Object} io 
   */
  async editMessage(clientManager, jid, messageId, newText, io = null) {
    if (!messageId || typeof messageId !== 'string') {
      throw new Error('ID da mensagem é obrigatório para edição.');
    }
    const cleanText = (newText || '').trim();
    if (!cleanText) {
      throw new Error('O novo texto da mensagem não pode estar vazio.');
    }
    const cleanJid = (jid || '').trim();

    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      throw new Error('WhatsApp Client não está conectado ou pronto para edição.');
    }

    const timestamp = ts();
    console.log(`[${timestamp}] [LiveChat] Solicitando edição da mensagem ${messageId}: "${cleanText.substring(0, 30)}..."`);

    let msg = null;
    try {
      msg = await client.getMessageById(messageId);
    } catch (findErr) {
      console.warn(`[${timestamp}] [LiveChat] getMessageById falhou: ${findErr.message}. Tentando via evaluate...`);
    }

    let editSuccess = false;
    if (msg && typeof msg.edit === 'function') {
      try {
        const result = await msg.edit(cleanText);
        editSuccess = Boolean(result);
      } catch (editErr) {
        console.error(`[LiveChat] Erro no msg.edit: ${editErr.message}`);
        throw new Error(`Falha ao editar mensagem no WhatsApp: ${editErr.message}`);
      }
    }

    if (!editSuccess) {
      // Fallback via evaluate direto na página
      const evalResult = await client.pupPage.evaluate(async (msgId, updatedText) => {
        try {
          const collections = window.require('WAWebCollections');
          const targetMsg = collections.Msg.get(msgId) ||
                            (await collections.Msg.getMessagesById([msgId]))?.messages?.[0];
          if (!targetMsg) return { success: false, error: 'Mensagem não encontrada na memória do WhatsApp.' };

          const canEdit = window.require('WAWebMsgActionCapability').canEditText(targetMsg) ||
                          window.require('WAWebMsgActionCapability').canEditCaption(targetMsg);
          if (!canEdit) {
            return {
              success: false,
              code: 'TIME_LIMIT_EXCEEDED',
              error: 'O WhatsApp só permite editar mensagens dentro de 15 minutos após o envio.'
            };
          }

          if (window.WWebJS && typeof window.WWebJS.editMessage === 'function') {
            const res = await window.WWebJS.editMessage(targetMsg, updatedText, {});
            return { success: true, serialized: res ? res.serialize() : null };
          }

          return { success: false, error: 'Mecanismo de edição WWebJS não disponível.' };
        } catch (e) {
          return { success: false, error: e.message || 'Erro ao editar mensagem.' };
        }
      }, messageId, cleanText);

      if (!evalResult.success) {
        const err = new Error(evalResult.error || 'Não foi possível editar a mensagem.');
        if (evalResult.code) err.code = evalResult.code;
        throw err;
      }
    }

    if (io) {
      io.emit('live-chat:message-edited', {
        jid: cleanJid,
        messageId,
        newBody: cleanText,
        timestamp: Date.now()
      });

      io.emit('system-log', {
        id: Date.now(),
        type: 'info',
        action: 'Mensagem Editada',
        message: `Mensagem atualizada: "${cleanText.length > 35 ? cleanText.substring(0, 35) + '…' : cleanText}"`,
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      messageId,
      newBody: cleanText,
      timestamp: Date.now()
    };
  }

  /**
   * Obtém o binário de uma imagem sob demanda com cache persistente em disco.
   * Não utiliza client.getMessageById() para evitar erro CDP -32000 em mensagens com quotedMsg.
   * @param {Object} clientManager 
   * @param {string} jid 
   * @param {string} messageId 
   * @returns {Promise<{fromCache: boolean, mimetype: string, stream?: any, buffer?: Buffer}|null>}
   */
  async getMessageMedia(clientManager, jid, messageId) {
    if (!messageId || typeof messageId !== 'string') return null;
    const sanitizedId = sanitizeMessageId(messageId);

    // 1. Verificação instantânea no cache do disco
    try {
      if (fs.existsSync(mediaCacheDir)) {
        const cachedFiles = await fs.promises.readdir(mediaCacheDir);
        const match = cachedFiles.find(f => f.startsWith(sanitizedId + '.'));
        if (match) {
          const filePath = path.join(mediaCacheDir, match);
          const ext = path.extname(match).toLowerCase();
          const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif'
          };
          const mimetype = mimeMap[ext] || 'image/jpeg';
          return {
            fromCache: true,
            filePath,
            mimetype,
            stream: fs.createReadStream(filePath)
          };
        }
      }
    } catch (cacheErr) {
      console.warn(`[LiveChatService] Aviso ao verificar cache de mídia: ${cacheErr.message}`);
    }

    // 2. Extração pontual via Puppeteer (apenas 1 avaliação CDP para este item específico)
    const client = clientManager && typeof clientManager.getClient === 'function' ? clientManager.getClient() : null;
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      return null;
    }

    try {
      const result = await client.pupPage.evaluate(async (targetJid, targetMsgId) => {
        try {
          const collections = window.require ? window.require('WAWebCollections') : null;
          if (!collections) return null;

          // Localiza a mensagem na Store
          let msg = collections.Msg?.get(targetMsgId);
          if (!msg && targetJid && collections.Chat) {
            const chat = collections.Chat.get(targetJid);
            if (chat && chat.msgs) {
              msg = chat.msgs.get(targetMsgId) ||
                    (chat.msgs.getModelsArray ? chat.msgs.getModelsArray().find(m => (m.id?._serialized === targetMsgId || m.id?.id === targetMsgId || m.id?.$1 === targetMsgId)) : null);
            }
          }

          if (!msg) {
            try {
              const fetchRes = await collections.Msg.getMessagesById([targetMsgId]);
              msg = fetchRes?.messages?.[0];
            } catch (_) {}
          }

          if (!msg || !msg.mediaData) {
            return null;
          }

          // Executa o download interno caso ainda não esteja em memória
          if (typeof msg.downloadMedia === 'function' && msg.mediaData.mediaStage !== 'RESOLVED') {
            try {
              await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true });
            } catch (_) {}
          }

          // Recupera o blob de mídia do cache ou do mediaObject
          let blob = null;
          try {
            const blobCache = window.require('WAWebMediaInMemoryBlobCache')?.InMemoryMediaBlobCache;
            if (blobCache && msg.mediaObject?.filehash) {
              blob = blobCache.get(msg.mediaObject.filehash);
            }
          } catch (_) {}

          if (!blob && msg.mediaObject?.mediaBlob && typeof msg.mediaObject.mediaBlob.forceToBlob === 'function') {
            blob = msg.mediaObject.mediaBlob.forceToBlob();
          }

          if (!blob) {
            return null;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const base64 = await window.WWebJS.arrayBufferToBase64Async(arrayBuffer);
          return {
            mimetype: msg.mimetype || blob.type || 'image/jpeg',
            data: base64
          };
        } catch (evalErr) {
          return null;
        }
      }, jid, messageId);

      if (!result || !result.data) {
        return null;
      }

      const buffer = Buffer.from(result.data, 'base64');
      const mimetype = result.mimetype || 'image/jpeg';
      let ext = '.jpg';
      if (mimetype.includes('png')) ext = '.png';
      else if (mimetype.includes('webp')) ext = '.webp';
      else if (mimetype.includes('gif')) ext = '.gif';

      // Salva de forma assíncrona no cache de disco
      const destPath = path.join(mediaCacheDir, `${sanitizedId}${ext}`);
      fs.promises.writeFile(destPath, buffer).catch(writeErr => {
        console.warn(`[LiveChatService] Falha ao gravar cache de mídia: ${writeErr.message}`);
      });

      return {
        fromCache: false,
        buffer,
        mimetype
      };
    } catch (err) {
      console.error(`[LiveChatService] Erro ao obter mídia da mensagem ${messageId}:`, err.message);
      return null;
    }
  }
}

module.exports = new LiveChatService();
