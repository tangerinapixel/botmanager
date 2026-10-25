// --- DEPENDÊNCIAS ---
const fs = require('fs');
const path = require('path');
const { invalidateContextCache } = require('./ai/smartPromptEngine');
const { processarMensagemConversacional } = require('./ai/conversationalAiService');

// --- Bloco de Inicialização ---

let genAI;
let model;
let initializationPromise = null;

const defaultContexto = {
  nomeBot: "Assistente Virtual",
  nomeEmpresa: "Sua Empresa",
  tipoNegocio: "atendimento ao cliente",
  tomDeVoz: "amigável",
  informacoes: {
    horarioAtendimento: "Segunda a Sexta, das 9h às 18h.",
    site: "",
    contatoHumano: "",
    produtos: [],
    gruposWhatsapp: [],
    principaisTopicos: []
  },
  promptConfig: {
    persona: "Você é o ${nomeBot}.",
    baseConhecimentoHeader: "",
    regrasGerais: []
  }
};

// Carrega as chaves do .env (GEMINI_API_KEYS="chave1,chave2,chave3")
// Separa por vírgula e remove espaços vazios para evitar erros
const apiKeys = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(k => k);
let currentKeyIndex = 0;

// Caminho do arquivo de contexto
const { getDataFilePath } = require('../utils/paths');
const contextFilePath = getDataFilePath('ia_context.json');
let contextoIA = null;

function loadContextoIA() {
  if (contextoIA) return;
  try {
    if (fs.existsSync(contextFilePath)) {
      const loaded = JSON.parse(fs.readFileSync(contextFilePath, 'utf8'));
      contextoIA = {
        ...defaultContexto,
        ...loaded,
        informacoes: { ...defaultContexto.informacoes, ...(loaded.informacoes || {}) },
        promptConfig: { ...defaultContexto.promptConfig, ...(loaded.promptConfig || {}) }
      };
    } else {
      contextoIA = defaultContexto;
    }
  } catch (error) {
    console.error('[GeminiService] Erro ao carregar ia_context.json:', error);
  }
}

// --- Função de Inicialização da IA ---
async function garantirInicializacaoIA() {
  // Se o model já existe e é válido, não recria
  if (model) return;

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');

      // Validação de segurança se não houver chaves
      if (apiKeys.length === 0) throw new Error("Nenhuma chave API encontrada no .env (GEMINI_API_KEYS)");

      // Loop de segurança: se o índice estourar o tamanho do array, volta para a primeira chave
      if (currentKeyIndex >= apiKeys.length) currentKeyIndex = 0;

      const currentKey = apiKeys[currentKeyIndex];

      // Log para debug (mostra apenas o final da chave por segurança)
      console.log(`[GeminiService] Inicializando com a chave índice [${currentKeyIndex}] (Final: ...${currentKey.slice(-4)})`);

      loadContextoIA();

      const preencherTemplate = (template) => {
        if (!template) return "";
        return template
          .replace(/\$\{\{?nomeBot\}?\}/g, contextoIA.nomeBot || "")
          .replace(/\$\{\{?nomeEmpresa\}?\}/g, contextoIA.nomeEmpresa || "")
          .replace(/\$\{\{?tipoNegocio\}?\}/g, contextoIA.tipoNegocio || "")
          .replace(/\$\{\{?tomDeVoz\}?\}/g, contextoIA.tomDeVoz || "")
          .replace(/\$\{\{?informacoes\.horarioAtendimento\}?\}/g, contextoIA.informacoes?.horarioAtendimento || "")
          .replace(/\$\{\{?informacoes\.site\}?\}/g, contextoIA.informacoes?.site || "")
          .replace(/\$\{\{?informacoes\.contatoHumano\}?\}/g, contextoIA.informacoes?.contatoHumano || "");
      };

      const produtosArray = Array.isArray(contextoIA.informacoes?.produtos)
        ? contextoIA.informacoes.produtos
        : [];
      const gruposArray = Array.isArray(contextoIA.informacoes?.gruposWhatsapp)
        ? contextoIA.informacoes.gruposWhatsapp
        : [];
      const topicosArray = Array.isArray(contextoIA.informacoes?.principaisTopicos)
        ? contextoIA.informacoes.principaisTopicos
        : [];

      const baseDeConhecimento = `
          - Horário de Atendimento: ${contextoIA.informacoes?.horarioAtendimento || ""}
          - Site Principal: ${contextoIA.informacoes?.site || ""}
          - Contato Humano: ${contextoIA.informacoes?.contatoHumano || ""}
          - Materiais Gratuitos: ${produtosArray.map(p => `${p.nome || ""} (${p.descricao || ""}) - Link: ${p.link || ""}`).join('; ')}
          - Grupos WhatsApp: ${gruposArray.map(g => `${g.nome || ""} - Link: ${g.link || ""}`).join('; ')}
          - Tópicos Principais: ${topicosArray.join(', ')}
      `;

      const instructions = `
          ${preencherTemplate(contextoIA.promptConfig.persona)}

          ## Base de Conhecimento ##
          ${contextoIA.promptConfig.baseConhecimentoHeader}
          ${baseDeConhecimento}

          ## Regras e Limitações ##
          ${(contextoIA.promptConfig.regrasGerais || []).map(regra => `- ${preencherTemplate(regra)}`).join('\n')}

          ---
          Com base estritamente no contexto e nas regras acima, responda à pergunta do usuário de forma direta e concisa.
      `;

      genAI = new GoogleGenerativeAI(currentKey);
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: instructions,
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 600
        }
      });

      console.log(`[GeminiService] Modelo [${modelName}] inicializado com sucesso usando systemInstruction e generationConfig.`);

    } catch (error) {
      console.error('[GeminiService] FALHA CRÍTICA ao inicializar a IA:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

// --- Atualização de Contexto (Mantida igual) ---
function atualizarContextoIA() {
  loadContextoIA();
  try {
    console.log('[GeminiService] Recarregando contexto da IA do arquivo...');
    invalidateContextCache();
    const loaded = JSON.parse(fs.readFileSync(contextFilePath, 'utf8'));
    contextoIA = {
      ...defaultContexto,
      ...loaded,
      informacoes: { ...defaultContexto.informacoes, ...(loaded.informacoes || {}) },
      promptConfig: { ...defaultContexto.promptConfig, ...(loaded.promptConfig || {}) }
    };
    console.log('[GeminiService] Contexto da IA recarregado com sucesso.');
    model = null; // Força re-inicialização do modelo com o novo systemInstruction
    return true;
  } catch (error) {
    console.error('[GeminiService] FALHA ao recarregar contexto da IA:', error);
    return false;
  }
}

// --- Função Principal Gerar Resposta ---
// retryCount: Variável interna para contar quantas vezes tentamos trocar de chave
async function gerarResposta(historicoOuPrompt, retryCount = 0) {
  loadContextoIA();
  try {
    await garantirInicializacaoIA();

    if (!model) {
      console.error("[GeminiService] Modelo indisponível.");
      return "Desculpe, o serviço de inteligência artificial está temporariamente indisponível.";
    }

    // Suporta tanto o array de histórico estruturado quanto uma string simples
    const contentPayload = Array.isArray(historicoOuPrompt)
      ? { contents: historicoOuPrompt }
      : historicoOuPrompt;

    const result = await model.generateContent(contentPayload);
    const response = await result.response;
    return response.text().trim();

  } catch (error) {
    // Detecta erros de cota (429), indisponibilidade temporária (503), permissão/recurso esgotado ou falhas de conexão/rede (fetch failed, TypeError, DNS)
    const isNetworkError = error.message.includes('fetch failed') ||
      error.message.includes('TypeError') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED');

    const isQuotaError = error.message.includes('429') ||
      error.message.includes('403') ||
      error.message.includes('503') ||
      error.message.includes('RESOURCE_EXHAUSTED') ||
      error.message.includes('Service Unavailable') ||
      (error.response && (error.response.status === 429 || error.response.status === 503));

    // Se for erro de cota ou falha de rede E ainda tivermos chaves para tentar
    if ((isQuotaError || isNetworkError) && retryCount < apiKeys.length) {
      console.warn(`[GeminiService] ⚠️ Falha detectada (Cota/Rede) na chave índice ${currentKeyIndex}. Detalhes: ${error.message}. Trocando chave...`);

      // 1. Avança para a próxima chave
      currentKeyIndex++;

      // 2. Força 'model' a ser null para que a função 'garantirInicializacaoIA' recrie a conexão
      model = null;

      // 3. Aguarda 2 segundos (backoff) antes de tentar a próxima chave
      console.log(`[GeminiService] ⏳ Aguardando 2 segundos antes de retentar com a próxima chave...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Tenta novamente a mesma função (Recursividade)
      console.log(`[GeminiService] 🔄 Retentando com a próxima chave... (Tentativa ${retryCount + 1})`);
      return gerarResposta(historicoOuPrompt, retryCount + 1);
    }

    // --- SE NÃO FOR POSSÍVEL RECUPERAR (ERRO FINAL) ---
    console.error('\n--- ERRO FINAL DA API GEMINI ---');
    console.error('Mensagem:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
    }

    // Resposta de emergência para o usuário
    return "Oi, estou com muita demanda agora. Tente novamente em alguns instantes.";
  }
}

// Exporta as funções para serem usadas no bot
module.exports = { gerarResposta, atualizarContextoIA, processarMensagemConversacional };