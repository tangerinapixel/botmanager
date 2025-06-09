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
let envioAtivo = null; // Irá armazenar o objeto retornado por startSending, que pode ter controles
let paused = false;    // Flag para pausa manual
let stopped = false;   // Flag para parada manual

module.exports = (client, io) => {
  // Rota para INICIAR o envio em massa
  router.post('/send-mass', upload.single('image'), async (req, res) => {
    // Verifica se já existe um envio ativo para evitar múltiplos envios simultâneos
    if (envioAtivo && !stopped) { // Se envioAtivo não é null e não foi explicitamente parado
        // E se o loop interno de startSending ainda puder estar rodando
        // A lógica para checar se realmente está "ativo" pode ser mais complexa
        // Por ora, uma checagem simples.
      console.warn('[ROUTE /send-mass] Tentativa de iniciar novo envio enquanto um já pode estar ativo ou não finalizado.');
      // return res.status(409).json({ success: false, message: 'Um envio em massa já está em progresso ou não foi finalizado corretamente.' });
    }

    console.log('[ROUTE /send-mass] Recebida nova solicitação de envio em massa.');
    try {
      // Reseta as flags de controle para um novo envio
      paused = false;
      stopped = false;
      envioAtivo = null; // Limpa referência anterior
      
      // Extrai os dados do corpo da requisição (FormData)
      const {
        contacts,            // String JSON vinda do frontend
        message,
        velocidade,
        pausaCada,           // << NOME CORRETO esperado do frontend
        duracaoPausaSegundos, // << NOVO PARÂMETRO esperado do frontend
        modoAmigavel,
        modoEscuro,
        removerDuplicados    // Flag para o processContacts
      } = req.body;

      // Validações básicas de entrada
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

      // Chama a função handler principal 'startSending'
      // 'envioAtivo' recebe o objeto retornado por startSending, que contém os métodos pause/resume/stop
      // que manipulam as closures onPause/onStop dentro de startSending.
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
        onPause: () => paused, // Passa a função que retorna o estado da flag 'paused'
        onStop: () => stopped   // Passa a função que retorna o estado da flag 'stopped'
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
    // Se a função pauseSending(envioAtivo) fizer algo mais (ex: chamar envioAtivo.pause()), mantenha.
    // Senão, apenas setar 'paused = true' é suficiente se startSending reage a isso.
    if (typeof pauseSending === 'function' && envioAtivo && typeof envioAtivo.pause === 'function') {
        // Se pauseSending espera o objeto retornado por startSending que tem o método .pause()
        // pauseSending(envioAtivo); // Esta chamada depende do que pauseSending faz.
        // Ou, se o objeto retornado por startSending tem um método pause:
        // if (envioAtivo.pause) envioAtivo.pause();
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
    // Se a função startSending tiver um método resume no objeto 'envioAtivo':
    // if (envioAtivo.resume) envioAtivo.resume();
    return res.json({ success: true, message: '▶️ Envio retomado manualmente.' });
  });

  // Rota para PARAR o envio em massa (controle manual)
  router.post('/stop-mass', (req, res) => {
    if (!envioAtivo) {
      return res.status(400).json({ success: false, message: 'Nenhum envio ativo para parar.' });
    }
    console.log('[ROUTE /stop-mass] Solicitação de PARADA manual recebida.');
    stopped = true; // Seta a flag global
    // Se a função stopSending fizer algo mais ou chamar envioAtivo.stop():
    // if (typeof stopSending === 'function' && envioAtivo && typeof envioAtivo.stop === 'function') {
        // stopSending(envioAtivo);
        // if (envioAtivo.stop) envioAtivo.stop();
    // }
    // É importante que o loop em startSending veja 'stopped = true' e pare.
    // Resetar envioAtivo aqui garante que um novo envio possa ser iniciado.
    envioAtivo = null; 
    paused = false; // Reseta a pausa também, pois parou tudo.
    return res.json({ success: true, message: '🛑 Envio parado manualmente.' });
  });

  return router;
};