// backend/wa-engine/WAEngine.js
// Orquestrador Central do Motor Soberano WhatsApp Web (WAEngine).
// Coordena os adaptadores modulares de Chats, Mídia, Mensagens, Etiquetas e Diagnóstico.

const ChatAdapter = require('./adapters/chatAdapter');
const MediaAdapter = require('./adapters/mediaAdapter');
const MessageAdapter = require('./adapters/messageAdapter');
const LabelLidAdapter = require('./adapters/labelLidAdapter');
const { ts } = require('../utils/logger');

class WAEngine {
  constructor() {
    this.isInitialized = false;
    this.lastHealthReport = null;
  }

  /**
   * Aplica todos os adaptadores de resiliência e correções de contratos no cliente.
   * Totalmente defensivo contra erros de página fechada ou ciclo de vida em transição.
   * @param {Object} client Instância do WhatsApp Web.js
   */
  async applyAll(client) {
    if (!client) return;

    try {
      if (client.pupPage && !client.pupPage.isClosed()) {
        // 1. Aplica adaptadores no contexto do navegador
        await ChatAdapter.applyBrowserPatch(client);
        await MediaAdapter.applyBrowserPatch(client);
        await MessageAdapter.applyBrowserPatch(client);
        await LabelLidAdapter.applyBrowserPatch(client);
      }

      // 2. Aplica adaptadores no nível do Node.js
      ChatAdapter.applyNodePatch(client);

      this.isInitialized = true;
    } catch (err) {
      console.warn(`[${ts()}] [WAEngine] Aviso ao aplicar adaptadores: ${err.message}`);
    }
  }

  /**
   * Executa a auditoria de saúde dos módulos e contratos do WhatsApp Web Comet.
   * @param {Object} client 
   * @returns {Promise<Object>} Relatório de saúde estruturado
   */
  async runHealthCheck(client) {
    try {
      const WAStoreHealthCheck = require('./diagnostics/waStoreHealthCheck');
      const report = await WAStoreHealthCheck.run(client);
      this.lastHealthReport = report;
      return report;
    } catch (err) {
      console.error(`[${ts()}] [WAEngine] Erro ao executar auto-diagnóstico: ${err.message}`);
      return {
        timestamp: Date.now(),
        status: 'ERROR',
        error: err.message,
        contracts: []
      };
    }
  }

  /**
   * Obtém o último relatório de saúde em cache.
   */
  getLastHealthReport() {
    return this.lastHealthReport;
  }
}

// Exporta singleton
module.exports = new WAEngine();
