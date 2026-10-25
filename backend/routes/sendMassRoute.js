const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Handler principal para o envio
const startSending = require('../handlers/massSender/startSending'); 
// Funções auxiliares (se você as usa para algo além de setar flags)
const pauseSending = require('../handlers/massSender/pauseSending'); 
const stopSending = require('../handlers/massSender/stopSending');   
// Função para processar contatos
const processContacts = require('../handlers/massSender/processContacts');

// Configuração do Multer para upload de imagem (local a este arquivo de rota)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'), // Certifique-se que a pasta 'uploads/' existe no backend
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Variáveis de controle de estado para o processo de envio em massa a nível de módulo.
// Isso significa que apenas um envio em massa pode ser controlado por vez por este módulo.
const filaEnvioEmMassa = [];
let envioAtivo = null; // Irá armazenar o objeto retornado por startSending, que pode ter controles
let paused = false;    // Flag para pausa manual
let stopped = false;   // Flag para parada manual

module.exports = (clientManager, io) => {
  const processarFila = async () => {
    if (filaEnvioEmMassa.length === 0) return;
    console.log(`[Fila Envio] Iniciando processamento de ${filaEnvioEmMassa.length} envios em massa acumulados...`);

    // Processamento sequencial com loop for...of e tratamento de erros individual
    for (const item of [...filaEnvioEmMassa]) {
      try {
        const client = clientManager.getClient();
        if (!client || clientManager.getState().waClientState !== 'READY') {
          console.warn('[Fila Envio] Cliente WhatsApp perdeu a conexão durante o processamento. Fila pausada.');
          break;
        }

        // Remove do buffer de fila ao iniciar processamento
        filaEnvioEmMassa.shift();

        const {
          contacts,
          message,
          velocidade,
          pausaCada,
          duracaoPausaSegundos,
          modoAmigavel,
          modoEscuro,
          removerDuplicados,
          file
        } = item;

        paused = false;
        stopped = false;
        envioAtivo = null;

        let parsedContactsArray;
        try {
          parsedContactsArray = typeof contacts === 'string' ? JSON.parse(contacts) : contacts;
        } catch (e) {
          console.error('[Fila Envio] Erro ao parsear contatos do item da fila:', e);
          continue; // Pula este item inválido e segue para o próximo
        }

        const contatosProcessados = processContacts(parsedContactsArray, removerDuplicados === 'true' || removerDuplicados === true);
        const imagePath = file ? file.path : null;

        console.log('[Fila Envio] Processando envio enfileirado:', {
            numContatosOriginal: parsedContactsArray.length,
            numContatosFiltrados: contatosProcessados.length,
            imagePresent: !!imagePath
        });

        envioAtivo = startSending({
          client,
          contatos: contatosProcessados,
          mensagem: message,
          imagePath,
          intervaloSegundos: parseInt(velocidade, 10) || 3,
          pausaCada: parseInt(pausaCada, 10) || 0,
          duracaoPausaSegundos: parseInt(duracaoPausaSegundos, 10) || 0,
          modoAmigavel: modoAmigavel === 'true' || modoAmigavel === true,
          modoEscuro: modoEscuro === 'true' || modoEscuro === true,
          io,
          onPause: () => paused,
          onStop: () => stopped
        });

        // Delay obrigatório de rate-limiting (3 segundos) entre inicios de lotes enfileirados
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (err) {
        console.error('[Fila Envio] Falha ao processar item da fila de envios:', err.message);
      }
    }
  };

  // Registra o processamento da fila ao restabelecer conexão (com delay de segurança de 10s)
  clientManager.onReady(() => {
    console.log('[Fila Envio] Dispositivo pronto detectado. Agendando processamento da fila de envios em 10 segundos...');
    setTimeout(processarFila, 10000);
  });

  // Rota para INICIAR o envio em massa
  router.post('/send-mass', upload.single('image'), async (req, res) => {
    // Verifica se já existe um envio ativo para evitar múltiplos envios simultâneos
    if (envioAtivo && !stopped) {
      console.warn('[ROUTE /send-mass] Tentativa de iniciar novo envio enquanto um já pode estar ativo ou não finalizado.');
    }

    console.log('[ROUTE /send-mass] Recebida nova solicitação de envio em massa.');
    try {
      const client = clientManager.getClient();
      const isReady = clientManager.getState().waClientState === 'READY' && client;

      // Se o cliente não estiver pronto, enfileira a requisição na memória
      if (!isReady) {
        console.log('[ROUTE /send-mass] Cliente WhatsApp não está READY. Enfileirando requisição de envio em massa...');
        filaEnvioEmMassa.push({
          contacts: req.body.contacts,
          message: req.body.message,
          velocidade: req.body.velocidade,
          pausaCada: req.body.pausaCada,
          duracaoPausaSegundos: req.body.duracaoPausaSegundos,
          modoAmigavel: req.body.modoAmigavel,
          modoEscuro: req.body.modoEscuro,
          removerDuplicados: req.body.removerDuplicados,
          file: req.file
        });
        return res.json({ success: true, queued: true, message: '⏱️ Cliente WhatsApp desconectado. Envio enfileirado para processamento automático assim que a conexão for restabelecida.' });
      }

      // Reseta as flags de controle para um novo envio
      paused = false;
      stopped = false;
      envioAtivo = null;

      const {
        contacts,
        message,
        velocidade,
        pausaCada,
        duracaoPausaSegundos,
        modoAmigavel,
        modoEscuro,
        removerDuplicados
      } = req.body;

      if (!contacts) {
        return res.status(400).json({ success: false, message: 'Lista de contatos é obrigatória.' });
      }
      if (!message && !req.file) {
        return res.status(400).json({ success: false, message: 'É necessário fornecer uma mensagem ou uma imagem.' });
      }

      let parsedContactsArray;
      try {
        parsedContactsArray = JSON.parse(contacts);
      } catch (e) {
        console.error('[ROUTE /send-mass] Erro ao parsear contatos JSON:', e);
        return res.status(400).json({ success: false, message: 'Formato inválido para a lista de contatos.' });
      }

      const contatosProcessados = processContacts(parsedContactsArray, removerDuplicados === 'true');
      const imagePath = req.file ? req.file.path : null;

      console.log('[ROUTE /send-mass] Parâmetros recebidos e processados:', {
          numContatosOriginais: parsedContactsArray.length,
          numContatosProcessados: contatosProcessados.length,
          mensagemLength: message ? message.length : 0,
          imagePresent: !!imagePath,
          velocidade, pausaCada, duracaoPausaSegundos, modoAmigavel, modoEscuro
      });

      envioAtivo = startSending({
        client,
        contatos: contatosProcessados,
        mensagem: message,
        imagePath,
        intervaloSegundos: parseInt(velocidade, 10) || 3,
        pausaCada: parseInt(pausaCada, 10) || 0,
        duracaoPausaSegundos: parseInt(duracaoPausaSegundos, 10) || 0,
        modoAmigavel: modoAmigavel === 'true',
        modoEscuro: modoEscuro === 'true',
        io,
        onPause: () => paused,
        onStop: () => stopped
      });

      return res.json({ success: true, message: '🚀 Processo de envio iniciado. Acompanhe o progresso.' });

    } catch (err) {
      console.error('[ROUTE /send-mass] Erro crítico ao iniciar envio em massa:', err);
      return res.status(500).json({ success: false, message: `Erro interno ao tentar iniciar o envio em massa: ${err.message}` });
    }
  });

  // Rota para PAUSAR o envio em massa (controle manual)
  router.post('/pause-mass', (req, res) => {
    if (!envioAtivo) {
      return res.status(400).json({ success: false, message: 'Nenhum envio ativo para pausar.' });
    }
    console.log('[ROUTE /pause-mass] Solicitação de PAUSA manual recebida.');
    paused = true; // Seta a flag global que é lida por onPause() dentro de startSending
    if (typeof pauseSending === 'function' && envioAtivo && typeof envioAtivo.pause === 'function') {
    }
    return res.json({ success: true, message: '⏸️ Envio pausado manualmente.' });
  });

  // Rota para RETOMAR o envio em massa (controle manual)
  router.post('/resume-mass', (req, res) => {
    if (!envioAtivo) {
      return res.status(400).json({ success: false, message: 'Nenhum envio ativo para retomar.' });
    }
    console.log('[ROUTE /resume-mass] Solicitação de RETOMADA manual recebida.');
    paused = false; // Libera a flag global
    return res.json({ success: true, message: '▶️ Envio retomado manualmente.' });
  });

  // Rota para PARAR o envio em massa (controle manual)
  router.post('/stop-mass', (req, res) => {
    console.log('[ROUTE /stop-mass] Solicitação de PARADA manual recebida.');
    stopped = true; // Seta a flag global
    envioAtivo = null; 
    paused = false; // Reseta a pausa também, pois parou tudo.
    return res.json({ success: true, message: '🛑 Envio parado manualmente.' });
  });

  return router;
};