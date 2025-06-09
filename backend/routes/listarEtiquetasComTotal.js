const express = require('express');
const router = express.Router();

// MODIFICADO: Agora aceita 'handleCriticalClientErrorFunc' como parâmetro
module.exports = function (client, handleCriticalClientErrorFunc) {
  router.get('/api/etiquetas-com-total', async (req, res) => {
    const timestamp = new Date().toISOString(); // Para logs consistentes

    try {
      // Verificação de prontidão do cliente
      if (!client.info || !client.pupPage) {
        console.warn(`[${timestamp}] [GET /api/etiquetas-com-total] Tentativa de chamar getLabels com cliente não pronto.`);
        return res.status(503).json({ error: 'Cliente WhatsApp ainda não está pronto. Por favor, aguarde a conexão e tente novamente.' });
      }

      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] Buscando labels...`);
      const labels = await client.getLabels(); // Pode lançar "Session closed"
      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] ${labels.length} labels encontradas. Processando chats...`);

      const resultado = [];
      for (const label of labels) {
        // client.getChats() também pode lançar "Session closed" se a página fechar durante o loop
        const chats = await label.getChats(); 
        const contatosIndividuais = chats.filter(chat => !chat.isGroup && chat.id && chat.id.user);
        resultado.push({
          id: label.id,
          nome: label.name,
          totalContatos: contatosIndividuais.length
        });
      }

      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] Processamento de etiquetas concluído.`);
      res.json({ etiquetas: resultado });

    } catch (err) {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] ❌ Erro em GET /api/etiquetas-com-total: Tipo: ${err.name}, Mensagem: ${err.message}`);
      
      // Chama a função centralizada de tratamento de erro crítico
      // Esta função irá verificar se é um erro de sessão fechada,
      // atualizar o waClientState e emitir 'status disconnected' para o frontend se necessário.
      if (typeof handleCriticalClientErrorFunc === 'function') {
        handleCriticalClientErrorFunc(err, 'GET /api/etiquetas-com-total');
      } else {
        console.error(`[${errorTimestamp}] [GET /api/etiquetas-com-total] handleCriticalClientErrorFunc não foi fornecida ou não é uma função.`);
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