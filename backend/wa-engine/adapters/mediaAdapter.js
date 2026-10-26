// backend/wa-engine/adapters/mediaAdapter.js
// Adaptador modular para o pipeline de Mídia do WhatsApp Web v2.3000+.
// Elimina o erro 'Data passed to getter must include an id property' e garante envio nativo como type: 'image'.

class MediaAdapter {
  /**
   * Aplica patches de mídia no contexto do navegador (Chromium).
   * A função passada para pupPage.evaluate é 100% autocontida.
   * @param {Object} client Instância do WhatsApp Web.js
   */
  static async applyBrowserPatch(client) {
    if (!client || !client.pupPage || client.pupPage.isClosed()) return;

    await client.pupPage.evaluate(() => {
      if (!window.WWebJS || window.WWebJS._processMediaDataPatched) return;

      const origProcessMediaData = window.WWebJS.processMediaData;
      if (typeof origProcessMediaData === 'function') {
        window.WWebJS.processMediaData = async function(mediaInfo, options = {}) {
          if (mediaInfo) {
            if (!mediaInfo.mimetype || mediaInfo.mimetype === 'null') {
              const ext = (mediaInfo.filename || '').split('.').pop().toLowerCase();
              if (ext === 'png') mediaInfo.mimetype = 'image/png';
              else if (ext === 'webp') mediaInfo.mimetype = 'image/webp';
              else if (ext === 'gif') mediaInfo.mimetype = 'image/gif';
              else mediaInfo.mimetype = 'image/jpeg';
            }
          }

          const mediaData = await origProcessMediaData.call(this, mediaInfo, options);
          if (mediaData) {
            // Elimina propriedades internas que corrompem o getter do MsgKey na v2.3000+
            try {
              delete mediaData.__x_id;
              delete mediaData.revisionNumber;
              delete mediaData.parent;
              delete mediaData.collection;
            } catch (_) {}

            // Garante de forma estrita e defensiva que mídias visuais sejam 'image' (e nunca 'document')
            if (mediaInfo && mediaInfo.mimetype && mediaInfo.mimetype.startsWith('image/') && !options?.forceDocument) {
              mediaData.type = 'image';
              if (mediaData.attributes) {
                mediaData.attributes.type = 'image';
              }
              if (typeof mediaData.set === 'function') {
                try { mediaData.set('type', 'image'); } catch (_) {}
              }
            }
          }
          return mediaData;
        };
        window.WWebJS._processMediaDataPatched = true;
      }
    });
  }
}

module.exports = MediaAdapter;
