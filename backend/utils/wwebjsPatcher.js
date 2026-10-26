// backend/utils/wwebjsPatcher.js
// Facade de retrocompatibilidade para o subsistema WAEngine.
// Mantém as assinaturas estáticas históricas delegando diretamente para os adaptadores modulares.

const WAEngine = require('../wa-engine/WAEngine');

class WWebJSPatcher {
  /**
   * Ponto de entrada histórico de aplicação de patches de resiliência.
   * Delega integralmente para o WAEngine orquestrado por adaptadores de domínio.
   * @param {Object} client Instância do WhatsApp Web.js
   */
  static async applyChatsPatch(client) {
    return WAEngine.applyAll(client);
  }
}

module.exports = WWebJSPatcher;
