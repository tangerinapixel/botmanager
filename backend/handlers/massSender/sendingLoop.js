// backend/handlers/massSender/sendingLoop.js
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enviarMensagem({ client, contato, mensagem, imagePath, modoAmigavel, modoEscuro }) {
  const numero = contato.numero;
  const nome = contato.nome || 'amigo';

  let msgFinal = mensagem.replace(/{{nome}}/gi, nome);

  if (modoAmigavel) msgFinal = `😊 Olá ${nome}! ${msgFinal}`;
  if (modoEscuro) msgFinal = `⚠️ *Aviso importante* ⚠️\n\n${msgFinal}`;

  try {
    if (imagePath && fs.existsSync(imagePath)) {
      const media = MessageMedia.fromFilePath(imagePath);
      await client.sendMessage(`${numero}@c.us`, media, { caption: msgFinal });
    } else {
      await client.sendMessage(`${numero}@c.us`, msgFinal);
    }
    return true;
  } catch (err) {
    console.error(`❌ Falha ao enviar para ${numero}:`, err.message);
    return false;
  }
}

module.exports = async function sendingLoop({
  client,
  contatos,
  mensagem,
  imagePath,
  intervaloSegundos,
  pausaCada,
  modoAmigavel,
  modoEscuro,
  io,
  onPause,
  onStop
}) {
  for (let i = 0; i < contatos.length; i++) {
    if (onStop?.()) break;

    while (onPause?.()) {
      await delay(1000); // Aguarda até "despausar"
    }

    const contato = contatos[i];
    const enviado = await enviarMensagem({
      client,
      contato,
      mensagem,
      imagePath,
      modoAmigavel,
      modoEscuro
    });

    if (io && enviado) {
      io.emit('massProgress', {
        progresso: i + 1,
        enviado: `${contato.numero} ${contato.nome || ''}`
      });
    }

    if ((i + 1) % pausaCada === 0) {
      await delay(5000); // Pausa padrão entre blocos
    }

    await delay(intervaloSegundos * 1000);
  }
};
