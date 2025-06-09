// Em handlers/messageHandler.js
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { enviarSaudacaoSeNecessario } = require('./saudacaoService');
const { loadFlows, matchFluxo } = require('./fluxoService');
const { jaRespondeuRecentemente, registrarResposta } = require('./historicoService');
const delay = require('../utils/delay');

// MODIFICADO: Adicionado 'handleCriticalClientError' como último parâmetro
async function processarMensagemNaoLida(msg, client, tempoExpiracaoMs, saudacaoAtiva, handleCriticalClientError) {
  const timestamp = new Date().toISOString(); // Para logs
  try {
    if (msg.fromMe || msg.type !== 'chat' || msg.from.endsWith('@g.us')) return;

    const remetente = msg.from;
    const texto = msg.body.toLowerCase().trim();

    // Envio de saudação pode envolver client.getChatById ou client.sendMessage indiretamente
    // Se enviarSaudacaoSeNecessario fizer chamadas ao 'client', idealmente ela também teria try...catch
    // ou passaria handleCriticalClientError para ela. Por ora, vamos focar nas chamadas diretas.
    try {
      await enviarSaudacaoSeNecessario(msg, client, saudacaoAtiva);
    } catch (saudacaoError) {
      console.error(`[${timestamp}] Erro no enviarSaudacaoSeNecessario para ${remetente}:`, saudacaoError.message);
      handleCriticalClientError(saudacaoError, `enviarSaudacaoSeNecessario para ${remetente}`);
      // Decidir se deve retornar aqui ou continuar para o fluxo. Se a saudação for crítica, retorne.
    }
    

    const flows = loadFlows();
    const fluxo = flows.find(f => matchFluxo(f, texto));

    if (!fluxo) {
      console.log(`[${timestamp}] ⚠️ Nenhum fluxo encontrado para: "${texto}" (remetente: ${remetente})`);
      return;
    }

    if (jaRespondeuRecentemente(remetente, fluxo.trigger, tempoExpiracaoMs)) {
      console.log(`[${timestamp}] ⏱️ Ignorado (processarMensagemNaoLida): já respondeu "${fluxo.trigger}" para ${remetente} recentemente.`);
      return;
    }

    const respostas = Array.isArray(fluxo.response)
      ? fluxo.response
      : fluxo.response.split('||').map(r => r.trim());
    const resposta = respostas[Math.floor(Math.random() * respostas.length)];

    const chat = await msg.getChat(); // Pode falhar se a sessão fechar
    await chat.sendStateTyping();    // Pode falhar
    await delay(3000); 

    if (fluxo.imageUrl) {
      const imagePath = path.join(__dirname, '../', fluxo.imageUrl); // Verifique este caminho!
      let media;
      try {
        media = MessageMedia.fromFilePath(imagePath);
      } catch (mediaPathError) {
        console.error(`[${timestamp}] ❌ Erro ao carregar imagem do caminho: ${imagePath}`, mediaPathError);
        // Notificar o usuário sobre o problema com a imagem e enviar apenas texto? Ou falhar?
        // Por ora, vamos tentar enviar apenas texto como fallback.
        handleCriticalClientError(mediaPathError, `carregar MessageMedia de ${imagePath}`); // Isso pode ser demais se for só um erro de caminho
                                                                                          // Mas se for erro de sessão, é válido.
        console.log(`[${timestamp}] Enviando apenas texto como fallback para ${remetente} devido a erro na imagem.`);
        await client.sendMessage(remetente, resposta); // Pode falhar
        registrarResposta(remetente, fluxo.trigger);
        console.log(`[${timestamp}] ✅ Resposta (fallback texto) enviada para ${remetente}: ${resposta.substring(0,50)}...`);
        return; // Sai após o fallback
      }
      await client.sendMessage(remetente, media, { caption: resposta }); // Pode falhar
    } else {
      await client.sendMessage(remetente, resposta); // Pode falhar
    }

    registrarResposta(remetente, fluxo.trigger);
    console.log(`[${timestamp}] ✅ Resposta enviada para ${remetente} (processarMensagemNaoLida): ${resposta.substring(0,50)}...`);

  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] ❌ Erro GERAL em processarMensagemNaoLida para ${msg.from}: Tipo: ${err.name}, Mensagem: ${err.message}`);
    if (typeof handleCriticalClientError === 'function') {
      handleCriticalClientError(err, `processarMensagemNaoLida para ${msg.from}`);
    } else {
      console.error(`[${errorTimestamp}] handleCriticalClientError não é uma função em processarMensagemNaoLida.`);
    }
    // Não relançar o erro aqui, pois já foi tratado e logado.
    // A função handleCriticalClientError cuidará de atualizar o estado global se necessário.
  }
}

const processarMensagem = processarMensagemNaoLida; // Mantém o alias

module.exports = {
  processarMensagem,
  processarMensagemNaoLida
};