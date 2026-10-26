// backend/wa-engine/adapters/labelLidAdapter.js
// Adaptador modular para o domínio de Etiquetas e Identificadores LID (Linked Identity Data)
// no WhatsApp Web v2.3000+.

class LabelLidAdapter {
  /**
   * Aplica patches ou extensões utilitárias no contexto do navegador se necessário.
   * @param {Object} client Instância do WhatsApp Web.js
   */
  static async applyBrowserPatch(client) {
    if (!client || !client.pupPage || client.pupPage.isClosed()) return;

    await client.pupPage.evaluate(() => {
      if (!window.WWebJS) return;

      // Garante método utilitário leve para extrair número de telefone de contato/LID
      if (!window.WWebJS.getContactPhoneNumber) {
        window.WWebJS.getContactPhoneNumber = async (contactId) => {
          try {
            const apiContact = window.require('WAWebApiContact');
            if (apiContact && typeof apiContact.getPhoneNumber === 'function') {
              const res = await apiContact.getPhoneNumber(contactId);
              if (res && res.user) return res.user;
            }
          } catch (_) {}
          return null;
        };
      }
    });
  }
}

module.exports = LabelLidAdapter;
