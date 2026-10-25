const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

/**
 * Envia uma mensagem com ou sem imagem.
 * @param {Client} client - Instância do WhatsApp Web.js
 * @param {Object} contato - Objeto com .numero e .nome
 * @param {String} mensagem - Texto da mensagem (usado como legenda se houver imagem)
 * @param {String|null} imagePath - Caminho local da imagem (opcional)
 */
async function enviarComOuSemImagem(client, contato, mensagem, imagePath, jid) {
  const destinatario = jid || `${contato.numero}@c.us`;
  try {
    if (imagePath && fs.existsSync(imagePath)) {
      const media = MessageMedia.fromFilePath(path.resolve(imagePath));
      await client.sendMessage(destinatario, media, {
        caption: mensagem
      });
    } else {
      await client.sendMessage(destinatario, mensagem);
    }
  } catch (err) {
    throw new Error(`Erro ao enviar mensagem para ${contato.numero}: ${err.message}`);
  }
}

module.exports = enviarComOuSemImagem;
