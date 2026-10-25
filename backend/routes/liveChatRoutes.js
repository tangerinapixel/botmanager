// backend/routes/liveChatRoutes.js
// Rotas da API REST para gerenciamento de chat em tempo real e atendimento

const express = require('express');
const router = express.Router();
const liveChatService = require('../services/liveChatService');
const { ts } = require('../utils/logger');

module.exports = function(clientManager, io) {
  // GET /api/live-chat/chats — Lista conversas recentes
  router.get('/chats', async (req, res) => {
    try {
      const result = await liveChatService.getRecentChats(clientManager);
      if (result && result.error) {
        console.warn(`[${ts()}] [LiveChatRoutes] Aviso em GET /chats (serviço retornou erro):`, result.error);
        return res.status(500).json(result);
      }
      return res.json(result);
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em GET /chats:`, err.message);
      return res.status(500).json({ ready: false, error: err.message, chats: [] });
    }
  });

  // GET /api/live-chat/messages/:jid — Obtém histórico de uma conversa
  router.get('/messages/:jid', async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await liveChatService.getChatMessages(clientManager, jid, limit);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em GET /messages/:jid:`, err.message);
      return res.status(400).json({ success: false, message: err.message, messages: [] });
    }
  });

  // GET /api/live-chat/avatar/:jid — Obtém a foto de perfil do contato sob demanda com cache
  router.get('/avatar/:jid', async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid);
      const avatarUrl = await liveChatService.getContactAvatar(clientManager, jid);
      return res.json({ success: true, jid, avatarUrl });
    } catch (err) {
      return res.json({ success: false, jid: req.params.jid, avatarUrl: null });
    }
  });

  // POST /api/live-chat/send — Envia mensagem para um contato
  router.post('/send', async (req, res) => {
    try {
      const { jid, message } = req.body;
      if (!jid || !message) {
        return res.status(400).json({ success: false, message: 'Parâmetros "jid" e "message" são obrigatórios.' });
      }

      const result = await liveChatService.sendMessage(clientManager, jid, message, io);
      return res.json(result);
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em POST /send:`, err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // DELETE /api/live-chat/messages/:messageId — Apaga mensagem enviada
  router.delete('/messages/:messageId', async (req, res) => {
    try {
      const messageId = decodeURIComponent(req.params.messageId);
      const jid = req.query.jid || req.body?.jid || '';
      const everyone = req.query.everyone !== 'false' && req.body?.everyone !== false;
      const result = await liveChatService.deleteMessage(clientManager, jid, messageId, everyone, io);
      return res.json(result);
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em DELETE /messages/:messageId:`, err.message);
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // PUT /api/live-chat/messages/:messageId — Edita mensagem nativamente no WhatsApp
  router.put('/messages/:messageId', async (req, res) => {
    try {
      const messageId = decodeURIComponent(req.params.messageId);
      const { jid, message, text } = req.body;
      const newText = message || text;
      if (!newText) {
        return res.status(400).json({ success: false, message: 'O parâmetro "message" com o novo texto é obrigatório.' });
      }

      const result = await liveChatService.editMessage(clientManager, jid, messageId, newText, io);
      return res.json(result);
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em PUT /messages/:messageId:`, err.message);
      const statusCode = err.code === 'TIME_LIMIT_EXCEEDED' ? 422 : 400;
      return res.status(statusCode).json({ success: false, code: err.code, message: err.message });
    }
  });

  return router;
};
