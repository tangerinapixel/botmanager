// backend/wa-engine/adapters/messageAdapter.js
// Adaptador modular para o pipeline de Envio e Resolução de Mensagens no WhatsApp Web v2.3000+.
// Garante retorno do ID real da mensagem mesmo antes da reconciliação assíncrona da coleção Msg.

class MessageAdapter {
  /**
   * Aplica patches de mensagens no contexto do navegador (Chromium).
   * A função passada para pupPage.evaluate é 100% autocontida.
   * @param {Object} client Instância do WhatsApp Web.js
   */
  static async applyBrowserPatch(client) {
    if (!client || !client.pupPage || client.pupPage.isClosed()) return;

    await client.pupPage.evaluate(() => {
      if (!window.WWebJS || window.WWebJS._sendMessagePatched) return;

      const origSendMessage = window.WWebJS.sendMessage;
      if (typeof origSendMessage === 'function') {
        window.WWebJS.sendMessage = async function(chat, content, options = {}) {
          const result = await origSendMessage.call(this, chat, content, options);

          // Se a função original retornou undefined/null (corrida assíncrona do Msg.get),
          // recupera imediatamente a mensagem enviada a partir da coleção de mensagens do chat
          if (!result && chat && chat.msgs) {
            const msgs = chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : [];
            const lastSent = msgs.slice(-1).find(m => m?.id?.fromMe);
            if (lastSent) return lastSent;
          }
          return result;
        };
        window.WWebJS._sendMessagePatched = true;
      }
    });
  }
}

module.exports = MessageAdapter;
