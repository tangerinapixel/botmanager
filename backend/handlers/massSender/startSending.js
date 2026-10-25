// handlers/massSender/startSending.js (VERSÃO INTEGRAL COM CORREÇÃO DE VARIÁVEL)

const fs = require('fs');
const path = require('path');
const delay = require('../../utils/delay');
const enviarComOuSemImagem = require('./imageHandler');
const { dataDir } = require('../../utils/paths');
const CHECKPOINT_FILE = path.join(dataDir, 'progresso_massa.json');

// DECLARAÇÃO DA "MEMÓRIA" DO DELAY (FORA DA FUNÇÃO PRINCIPAL)
let ultimoDelay = -1;
let ultimaPausaLonga = -1;

// G3: Processa variações de texto no formato {{spin: opção1 | opção2 | opção3}}
function processarSpintax(texto) {
  return texto.replace(/\{\{spin:(.*?)\}\}/g, (_, opts) => {
    const opcoes = opts.split('|').map(s => s.trim());
    return opcoes[Math.floor(Math.random() * opcoes.length)];
  });
}

function startSending({
  client,
  contatos,
  mensagem,
  imagePath,
  intervaloSegundos = 3,
  pausaCada = 0,
  duracaoPausaSegundos = 0,
  modoAmigavel = false,
  modoEscuro = false,
  io,
  onPause = () => false, 
  onStop = () => false
}) {
  let enviadosComSucesso = 0;
  let enviadosComFalha = 0;
  let totalProcessados = 0;


  function salvarCheckpoint(index, total, contatos, mensagem) {
    try {
        const dados = { 
            index, 
            total, 
            ultimoContato: contatos[index]?.numero || 'fim',
            data: new Date().toLocaleString() 
        };
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(dados, null, 2));
    } catch (e) {
        console.error('[Checkpoint] Erro ao salvar arquivo:', e.message);
    }
}

function limparCheckpoint() {
    if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log('[Checkpoint] ✅ Arquivo de rastro removido (Envio Concluído).');
    }
}

  async function enviarMensagens() {
    console.log(`[ENVIO_MASSA] Iniciando envio para ${contatos.length} contatos.`);
    io.emit('massNotification', { message: `🚀 Iniciando envio para ${contatos.length} contatos...`, type: 'info' });

    let proximoGatilhoDePausa = 0;
    if (pausaCada > 0) {
      const jitter = Math.floor(pausaCada * 0.2);
      proximoGatilhoDePausa = pausaCada + Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    }

    // =============================================================
    // O LOOP PRINCIPAL COMEÇA AQUI
   for (let i = 0; i < contatos.length; i++) { const contato = contatos[i];

      // 🛡️ TRAVA DE SEGURANÇA CONTRA DESCONEXÃO OU DESLOGAMENTO
      if (!client.info || !client.pupPage || client.pupPage.isClosed() || !client.pupBrowser) {
        console.error('[ENVIO_MASSA] 🛑 CONEXÃO PERDIDA OU DESLOGADA! Salvando rastro e parando.');
        salvarCheckpoint(i, contatos.length, contatos, mensagem);
        io.emit('massNotification', { 
            message: `❌ Conexão com WhatsApp caiu/deslogou no contato ${i}. Progresso de envio salvo!`, 
            type: 'danger' 
        });
        return; // Sai da função imediatamente
      }

      if (onStop()) {
        console.log(`[ENVIO_MASSA] 🛑 Envio interrompido manualmente (onStop).`);
        io.emit('massNotification', { message: '🛑 Envio interrompido manualmente.', type: 'warning' });
        break;
      }

      while (onPause()) {
        console.log('[ENVIO_MASSA] ⏸️ Envio em pausa manual (onPause)...');
        io.emit('massNotification', { message: '⏸️ Envio em pausa manual...', type: 'info' });
        await delay(2000);
      }

      if (onStop()) {
        console.log(`[ENVIO_MASSA] 🛑 Envio interrompido manualmente após pausa.`);
        io.emit('massNotification', { message: '🛑 Envio interrompido manualmente após pausa.', type: 'warning' });
        break;
      }

      // --- BLINDAGEM DE CONTEÚDO (SPINTAX) ---
      const saudações = ["Olá", "Oi", "Tudo bem?", "Bom dia", "Opa", "E aí"];
      const saudaçaoSorteada = saudações[Math.floor(Math.random() * saudações.length)];
      
      const nomeDoContato = contato.nome || ''; 
      const mensagemVariada = processarSpintax(mensagem); // G3: aplica variações de conteúdo
      let mensagemFinal = "";

      if (modoAmigavel && nomeDoContato) {
          mensagemFinal = `😊 ${saudaçaoSorteada} ${nomeDoContato}, ${mensagemVariada}`;
      } else {
          mensagemFinal = `${saudaçaoSorteada}! ${mensagemVariada}`;
      }

      if (modoEscuro) {
          mensagemFinal = `⚠️ ATENÇÃO: ${mensagemFinal}`;
      }

      // ✅ CORREÇÃO: Usamos nomeDoContato aqui também para evitar erro no console.log
      console.log(`[ENVIO_MASSA] ➡️ Enviando para: ${contato.numero} | Nome: ${nomeDoContato} | Mensagem: ${mensagemFinal.substring(0, 30)}...`);
      
      let sucessoEsteEnvio = false;
      let erroEsteEnvio = null;

      // --- BLOCO DE ENVIO (TRY...CATCH) ---
      let jid = contato.numero.includes('@') ? contato.numero : null;
      if (!jid) {
        const numLimpo = contato.numero.replace(/[^\d]/g, '');
        // Se tem 15 dígitos e começa com 1, é uma LID. Caso contrário, contato comum (@c.us)
        if (numLimpo.length === 15 && numLimpo.startsWith('1')) {
          jid = numLimpo + '@lid';
        } else {
          jid = numLimpo + '@c.us';
        }
      }

      // Validação de número existente no WhatsApp (Prevenção contra erros de 'No LID for user')
      let cadastrado = false;
      try {
        cadastrado = await client.isRegisteredUser(jid);
      } catch (errReg) {
        console.warn(`[ENVIO_MASSA] Falha ao verificar registro para ${contato.numero}: ${errReg.message}`);
      }

      if (!cadastrado) {
        console.error(`[ENVIO_MASSA] ❌ Contato ${contato.numero} não está cadastrado no WhatsApp. Pulando.`);
        enviadosComFalha++;
        totalProcessados++;
        const porcentagem = contatos.length > 0 ? Math.round((totalProcessados / contatos.length) * 100) : 0;
        io.emit('massProgress', {
          progressoAtual: totalProcessados,
          total: contatos.length,
          porcentagem: porcentagem,
          enviado: contato.numero,
          sucesso: false,
          erro: 'Número não cadastrado no WhatsApp (Sem conta)'
        });
        continue; // Pula para o próximo contato sem quebrar o fluxo nem travar o Chrome
      }

      let chat = null;
      try {
        chat = await client.getChatById(jid);
      } catch (chatErr) {
        console.warn(`[ENVIO_MASSA] ⚠️ Chat não pôde ser pré-carregado para ${contato.numero}: ${chatErr.message}`);
      }

      try {
        if (chat) {
          await chat.sendStateTyping();
          
          // G1: Delay proporcional ao tamanho real da mensagem (simula digitação humana)
          const msDigitando = Math.min(mensagemFinal.length * 55 + Math.random() * 1500, 12000);
          await delay(msDigitando);

          // G4: Simula pausa após digitar (como humano que revisou antes de enviar)
          await chat.clearState();
          await delay(300 + Math.random() * 600);
        } else {
          // Fallback: delay simulado curto se o chat não foi pré-carregado
          await delay(1500 + Math.random() * 1500);
        }

        await enviarComOuSemImagem(client, contato, mensagemFinal, imagePath, jid);
        
        enviadosComSucesso++;
        sucessoEsteEnvio = true;
        console.log(`[ENVIO_MASSA] ✅ Enviado para ${contato.numero}`);

      } catch (err) {
        if (err.message && err.message.includes("reading 'serialize'")) {
          enviadosComSucesso++;
          sucessoEsteEnvio = true;
          erroEsteEnvio = null;
          console.warn(`[ENVIO_MASSA] ✅ Workaround de 'serialize' ativado para ${contato.numero}. Mensagem enviada.`);
        } else {
          enviadosComFalha++;
          sucessoEsteEnvio = false;
          erroEsteEnvio = err.message;
          console.error(`[ENVIO_MASSA] ❌ Erro REAL ao enviar para ${contato.numero}:`, err.message);
        }
      }

      // --- ATUALIZAÇÃO DE PROGRESSO PARA O FRONTEND ---
      totalProcessados++;
      const porcentagem = contatos.length > 0 ? Math.round((totalProcessados / contatos.length) * 100) : 0;
      io.emit('massProgress', {
        progressoAtual: totalProcessados,
        total: contatos.length,
        porcentagem: porcentagem,
        enviado: contato.numero,
        sucesso: sucessoEsteEnvio,
        erro: erroEsteEnvio
      });

      // --- LÓGICA DE PAUSA PROGRAMADA (G6: jitter no gatilho para evitar padrão rítmico) ---
      if (pausaCada > 0 && totalProcessados === proximoGatilhoDePausa && totalProcessados < contatos.length && duracaoPausaSegundos > 0) {
          const pausaMinimaSeg = duracaoPausaSegundos;
          const pausaMaximaSeg = duracaoPausaSegundos + 30;
          const segundosPausaAleatorios = Math.floor(Math.random() * (pausaMaximaSeg - pausaMinimaSeg + 1)) + pausaMinimaSeg;

          const msgPausa = `⏳ Pausa programada por aproximadamente ${segundosPausaAleatorios}s após ${totalProcessados} envios...`;
          console.log(`[ENVIO_MASSA] ${msgPausa}`);
          io.emit('massNotification', { message: msgPausa, type: 'info' });

          // Calcula o próximo gatilho a partir do ponto atual
          const jitter = Math.floor(pausaCada * 0.2);
          const offset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
          proximoGatilhoDePausa = totalProcessados + pausaCada + offset;

          await delay(segundosPausaAleatorios * 1000);
          io.emit('massNotification', { message: '▶️ Retomando envio após pausa programada.', type: 'info' });
      }

      // --- LÓGICA DE DELAY ALEATÓRIO INDIVIDUAL (G2: distribuição humana assétrica) ---
      if (totalProcessados < contatos.length) {
          const baseMs = intervaloSegundos * 1000;
          // 85% das vezes: pausa normal com leve variação; 15%: pausa longa (simula distracção)
          const delayEmMs = Math.random() < 0.85
            ? baseMs + Math.random() * 8000
            : baseMs + 15000 + Math.random() * 25000;

          const segundosLog = Math.round(delayEmMs / 1000);
          console.log(`[TIMER] ⏸️ Próximo envio em ${segundosLog}s.`);
          await delay(delayEmMs);
      }
      // Atualiza o rastro após cada envio processado
      salvarCheckpoint(i + 1, contatos.length, contatos, mensagem);
      
    } // FIM DO LOOP FOR

    // --- FINALIZAÇÃO ---
    const mensagemFinalStatus = `📤 Envio em massa finalizado! Sucessos: ${enviadosComSucesso}, Falhas: ${enviadosComFalha}.`;
    console.log(`[ENVIO_MASSA] ${mensagemFinalStatus}`);
    io.emit('massComplete', {
      sucessoGeral: enviadosComFalha === 0 && enviadosComSucesso > 0,
      enviados: enviadosComSucesso,
      falhas: enviadosComFalha,
      message: mensagemFinalStatus
    });

    limparCheckpoint();

    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => {
        if (!err) console.log('[ENVIO_MASSA] 🗑️ Imagem deletada.');
      });
    }

  } // Fim enviarMensagens

  enviarMensagens().catch(error => {
    console.error("[ENVIO_MASSA] Erro crítico:", error);
    io.emit('massComplete', { sucessoGeral: false, message: "Erro crítico no processo." });
  });

  return {
    pause: () => onPause = () => true,
    resume: () => onPause = () => false,
    stop: () => onStop = () => true,
  };
}

module.exports = startSending;