// backend/services/ai/conversationalAiService.js
// Orquestrador principal da IA conversacional: coordena persistência, contexto dinâmico e inferência via Google Gemini.

const aiMemoryRepository = require('./aiMemoryRepository');
const smartPromptEngine = require('./smartPromptEngine');

// Carrega as chaves da API Gemini do arquivo .env
const apiKeys = (process.env.GEMINI_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

let currentKeyIndex = 0;

/**
 * Retorna uma instância do modelo Gemini inicializada com a instrução de sistema dinâmica
 */
async function getGenerativeModel(systemInstruction) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  if (apiKeys.length === 0) {
    throw new Error('Nenhuma chave de API configurada no .env (GEMINI_API_KEYS)');
  }

  if (currentKeyIndex >= apiKeys.length) {
    currentKeyIndex = 0;
  }

  const currentKey = apiKeys[currentKeyIndex];
  const genAI = new GoogleGenerativeAI(currentKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: 0.75, // Ajustado para diálogo natural, acolhedor e empático
      topP: 0.95,
      maxOutputTokens: 800
    }
  });
}

/**
 * Executa a chamada à API Gemini com suporte a rotação inteligente de chaves e retry
 */
async function executeGeminiCall(systemInstruction, contentsPayload, retryCount = 0) {
  try {
    const model = await getGenerativeModel(systemInstruction);
    const result = await model.generateContent({ contents: contentsPayload });
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    const isNetworkError =
      error.message.includes('fetch failed') ||
      error.message.includes('TypeError') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED');

    const isQuotaError =
      error.message.includes('429') ||
      error.message.includes('403') ||
      error.message.includes('503') ||
      error.message.includes('RESOURCE_EXHAUSTED') ||
      error.message.includes('Service Unavailable') ||
      (error.response && (error.response.status === 429 || error.response.status === 503));

    if ((isQuotaError || isNetworkError) && retryCount < apiKeys.length) {
      console.warn(`[ConversationalAI] ⚠️ Falha na chave índice ${currentKeyIndex} (${error.message}). Rotacionando para próxima chave...`);
      currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

      // Backoff de 1.5s antes de retentar
      await new Promise(resolve => setTimeout(resolve, 1500));
      return executeGeminiCall(systemInstruction, contentsPayload, retryCount + 1);
    }

    console.error('[ConversationalAI] Erro definitivo na API Gemini:', error.message);
    throw error;
  }
}

/**
 * Função Principal Conversacional:
 * 1. Resgata sessão e perfil persistente do contato
 * 2. Constrói instrução de sistema adaptativa (tempo real + histórico)
 * 3. Formata os turnos para a API Gemini
 * 4. Executa a inferência
 * 5. Persiste as mensagens no repositório
 */
async function processarMensagemConversacional(jid, textoMensagem, contactInfo = {}) {
  if (!jid || !textoMensagem || typeof textoMensagem !== 'string') {
    return 'Desculpe, não consegui compreender sua mensagem.';
  }

  const cleanText = textoMensagem.trim();
  if (!cleanText) return '';

  try {
    // 1. Registra a mensagem do usuário no histórico persistente
    const session = aiMemoryRepository.addMessageTurn(jid, 'user', cleanText, contactInfo);

    // 2. Constrói a instrução dinâmica com base no momento e histórico do cliente
    const dynamicSystemInstruction = smartPromptEngine.buildDynamicSystemInstruction(session);

    // 3. Monta os turnos formatados para a API Gemini
    const contentsPayload = aiMemoryRepository.getFormattedGeminiHistory(jid, cleanText, 14);

    // 4. Gera a resposta da IA
    const respostaTexto = await executeGeminiCall(dynamicSystemInstruction, contentsPayload);

    // 5. Registra a resposta da IA no histórico persistente
    aiMemoryRepository.addMessageTurn(jid, 'model', respostaTexto);

    // 6. Atualiza metadados se a resposta conteve o link do grupo
    if (respostaTexto.includes('chat.whatsapp.com')) {
      aiMemoryRepository.updateContactMetadata(jid, { jaRecebeuLinkGrupo: true });
    }

    return respostaTexto;
  } catch (err) {
    console.error(`[ConversationalAI] Erro ao processar mensagem para ${jid}:`, err.message);
    return 'Oi! No momento estou com uma alta demanda de mensagens. Pode repetir sua dúvida em alguns instantes?';
  }
}

module.exports = {
  processarMensagemConversacional,
  aiMemoryRepository,
  smartPromptEngine
};
