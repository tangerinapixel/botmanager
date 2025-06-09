const fs = require('fs');
const delay = require('../../utils/delay');
const enviarComOuSemImagem = require('./imageHandler');

// MODIFICADO: Adicionado duracaoPausaSegundos aos parâmetros da função
function startSending({
  client,
  contatos, // Array de objetos { numero: string, nome: string }
  mensagem,
  imagePath,
  intervaloSegundos = 3,
  pausaCada = 0, // Renomeado de pausaAposEnvios para consistência com formData, default 0 (sem pausa de bloco)
  duracaoPausaSegundos = 0, // NOVO PARÂMETRO, default 0 (sem duração de pausa)
  modoAmigavel = false,
  modoEscuro = false,
  io,
  // onPause e onStop são para controle manual externo, mantidos se sua API os usa
  onPause = () => false, 
  onStop = () => false
}) {
  let enviadosComSucesso = 0; // Contador de sucessos
  let enviadosComFalha = 0;   // Contador de falhas
  let totalProcessados = 0;   // Contador total de contatos processados (sucesso + falha)

  async function enviarMensagens() {
    console.log(`[ENVIO_MASSA] Iniciando envio para ${contatos.length} contatos.`);
    io.emit('massNotification', { message: `🚀 Iniciando envio para ${contatos.length} contatos...`, type: 'info' });

    for (const contato of contatos) {
      if (onStop()) {
        console.log(`[ENVIO_MASSA] 🛑 Envio interrompido manualmente (onStop).`);
        io.emit('massNotification', { message: '🛑 Envio interrompido manualmente.', type: 'warning' });
        break;
      }

      while (onPause()) {
        console.log('[ENVIO_MASSA] ⏸️ Envio em pausa manual (onPause)...');
        io.emit('massNotification', { message: '⏸️ Envio em pausa manual...', type: 'info' });
        await delay(2000); // Verifica a cada 2 segundos se saiu da pausa manual
      }

      if (onStop()) { // Verifica novamente após possível pausa manual
        console.log(`[ENVIO_MASSA] 🛑 Envio interrompido manualmente após pausa.`);
        io.emit('massNotification', { message: '🛑 Envio interrompido manualmente após pausa.', type: 'warning' });
        break;
      }

      let mensagemFinal = mensagem;
      let nomeContato = contato.nome || ''; // Garante que nomeContato seja uma string

      if (modoAmigavel && nomeContato) { // Só adiciona nome se existir
        mensagemFinal = `😊 Olá ${nomeContato}, ${mensagem}`;
      } else if (modoEscuro) {
        mensagemFinal = `⚠️ ATENÇÃO ${mensagem}`;
      }

      console.log(`[ENVIO_MASSA] ➡️ Enviando para: ${contato.numero} | Nome: ${nomeContato} | Mensagem: ${mensagemFinal.substring(0, 30)}...`);
      let sucessoEsteEnvio = false;
      let erroEsteEnvio = null;

      try {
        const chat = await client.getChatById(contato.numero + '@c.us');
        await chat.sendStateTyping();
        await delay(Math.max(500, Math.random() * 1500 + 500)); // Pequeno delay aleatório antes de digitar

        await enviarComOuSemImagem(client, contato, mensagemFinal, imagePath);

        enviadosComSucesso++;
        sucessoEsteEnvio = true;
        console.log(`[ENVIO_MASSA] ✅ Enviado para ${contato.numero}`);

      } catch (err) {
        enviadosComFalha++;
        erroEsteEnvio = err.message;
        console.error(`[ENVIO_MASSA] ❌ Erro ao enviar para ${contato.numero}:`, err.message);
      }

      totalProcessados++;
      // MODIFICADO: Evento massProgress mais completo
      io.emit('massProgress', {
        progressoAtual: totalProcessados, // Número de contatos processados
        total: contatos.length,          // Total de contatos na lista
        enviado: contato.numero,         // Número para o qual foi tentado o envio
        sucesso: sucessoEsteEnvio,       // Booleano indicando sucesso para este contato
        erro: erroEsteEnvio              // Mensagem de erro se falhou para este contato
      });

      // Lógica da Pausa Automática PROGRAMADA (APÓS X MENSAGENS)
      if (pausaCada > 0 && totalProcessados < contatos.length && totalProcessados % pausaCada === 0) {
        if (duracaoPausaSegundos > 0) {
          const msgPausa = `⏳ Pausa programada por ${duracaoPausaSegundos} segundos após ${totalProcessados} envios...`;
          console.log(`[ENVIO_MASSA] ${msgPausa}`);
          io.emit('massNotification', { message: msgPausa, type: 'info' });

          await delay(duracaoPausaSegundos * 1000); // Pausa pela duração configurada

          const msgRetomada = '▶️ Retomando envio após pausa programada.';
          console.log(`[ENVIO_MASSA] ${msgRetomada}`);
          io.emit('massNotification', { message: msgRetomada, type: 'info' });
        } else {
          console.log(`[ENVIO_MASSA] Pausa a cada ${pausaCada} envios configurada, mas duração da pausa é 0. Continuando...`);
        }
      }

      // Delay entre mensagens individuais (APÓS a pausa programada, se houver)
      if (totalProcessados < contatos.length) { // Não esperar após o último envio
          await delay(intervaloSegundos * 1000);
      }

    } // Fim do loop for

    const mensagemFinalStatus = `📤 Envio em massa finalizado! Sucessos: ${enviadosComSucesso}, Falhas: ${enviadosComFalha}.`;
    console.log(`[ENVIO_MASSA] ${mensagemFinalStatus}`);
    // Emitir evento de conclusão para o frontend
    io.emit('massComplete', {
        sucessoGeral: enviadosComFalha === 0 && enviadosComSucesso > 0, // Considera sucesso geral se não houver falhas e pelo menos um sucesso
        enviados: enviadosComSucesso,
        falhas: enviadosComFalha,
        message: mensagemFinalStatus,
        detalhes: { // Você pode popular isso com mais detalhes se necessário
            // enviados: listaDeNumerosEnviadosComSucesso,
            // falhas: listaDeNumerosComFalhaEMotivo
        }
    });

    // Deleta a imagem após o envio completo
    if (imagePath) {
      fs.unlink(imagePath, (errUnlink) => {
        if (errUnlink) {
          console.error('[ENVIO_MASSA] ❌ Erro ao deletar imagem após envio:', errUnlink);
          io.emit('massNotification', { message: `Erro ao deletar imagem: ${errUnlink.message}`, type: 'error' });
        } else {
          console.log('[ENVIO_MASSA] 🗑️ Imagem deletada automaticamente após o envio.');
          io.emit('massNotification', { message: '✔️​ Envio concluido com sucesso', type: 'info' });
        }
      });
    }
  } 

  enviarMensagens().catch(error => {
    // Captura erros inesperados da função assíncrona enviarMensagens
    console.error("[ENVIO_MASSA] Erro não esperado no processo de envio em massa:", error);
    io.emit('massComplete', {
        sucessoGeral: false,
        enviados: enviadosComSucesso,
        falhas: contatos.length - enviadosComSucesso, // Estima falhas se o processo quebrou
        message: "Erro crítico durante o envio em massa. Verifique os logs do servidor.",
        detalhes: {}
    });
  });

  // O retorno das funções de controle manual é mantido como no seu original
  // Essas funções onPause/onStop são passadas e modificadas externamente.
  return {
    pause: () => onPause = () => true,
    resume: () => onPause = () => false,
    stop: () => onStop = () => true,
  };
}

module.exports = startSending;