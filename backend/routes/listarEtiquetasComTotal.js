const express = require('express');
const router = express.Router();
const { ts } = require('../utils/logger');

module.exports = function (clientManager, handleCriticalClientErrorFunc) {
  router.get('/api/etiquetas-com-total', async (req, res) => {
    const timestamp = ts();

    try {
      const client = clientManager.getClient();
      // Verificação de prontidão do cliente
      if (!client || !client.info || !client.pupPage) {
        console.warn(`[${timestamp}] [GET /api/etiquetas-com-total] Tentativa de chamar getLabels com cliente não pronto.`);
        return res.status(503).json({ error: 'Cliente WhatsApp ainda não está pronto. Por favor, aguarde a conexão e tente novamente.' });
      }

      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] Buscando labels...`);
      const labels = await client.getLabels(); // Pode lançar "Session closed"
      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] ${labels.length} labels encontradas. Processando chats...`);

      const resultado = await Promise.all(labels.map(async (label) => {
        try {
          const chats = await label.getChats(); 
          const contatosIndividuais = chats.filter(chat => {
            if (!chat || !chat.id) return false;
            const isIndividual = chat.id.server === 'c.us' || chat.id._serialized?.endsWith('@c.us');
            return isIndividual && !chat.isGroup;
          });
          return {
            id: label.id,
            nome: label.name,
            totalContatos: contatosIndividuais.length
          };
        } catch (labelErr) {
          console.warn(`[${timestamp}] [GET /api/etiquetas-com-total] ⚠️ Erro ao obter chats da etiqueta "${label.name}":`, labelErr.message);
          return {
            id: label.id,
            nome: label.name,
            totalContatos: 0
          };
        }
      }));

      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] Processamento de etiquetas concluído.`);
      res.json({ etiquetas: resultado });

    } catch (err) {
      const errorTimestamp = ts();
      console.error(`[${errorTimestamp}] ❌ Erro em GET /api/etiquetas-com-total: Tipo: ${err.name}, Mensagem: ${err.message}`);
      
      if (typeof handleCriticalClientErrorFunc === 'function') {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('target closed') || errMsg.includes('session closed') || errMsg.includes('protocol error')) {
          handleCriticalClientErrorFunc(err, 'GET /api/etiquetas-com-total');
        }
      }
      
      // Responde com um erro genérico para esta chamada de API específica.
      // A notificação de desconexão geral (se aplicável) será feita por handleCriticalClientErrorFunc via Socket.IO.
      res.status(500).json({ 
        error: 'Erro ao buscar etiquetas.', 
        details: err.message // Pode ser útil para o frontend, mas considere a sensibilidade da informação
      });
    }
  });

  return router;
};