// backend/routes/liveChatRoutes.js
// Rotas da API REST para gerenciamento de chat em tempo real e atendimento

const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const liveChatService = require('../services/liveChatService');
const { ts } = require('../utils/logger');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const upload = multer({ dest: uploadsDir });

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

  // GET /api/live-chat/media/:jid/:messageId ou /api/live-chat/media/:messageId — Obtém imagem sob demanda com cache
  router.get(['/media/:jid/:messageId', '/media/:messageId'], async (req, res) => {
    try {
      const jid = req.params.jid ? decodeURIComponent(req.params.jid) : '';
      const messageId = decodeURIComponent(req.params.messageId);

      const media = await liveChatService.getMessageMedia(clientManager, jid, messageId);
      if (!media) {
        return res.status(404).json({ success: false, message: 'Mídia não encontrada ou indisponível.' });
      }

      res.setHeader('Content-Type', media.mimetype || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

      if (media.stream) {
        return media.stream.pipe(res);
      } else if (media.buffer) {
        return res.end(media.buffer);
      }

      return res.status(404).end();
    } catch (err) {
      console.error(`[${ts()}] [LiveChatRoutes] Erro em GET /media:`, err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/live-chat/send — Envia mensagem para um contato (texto e/ou imagem)
  router.post('/send', upload.single('image'), async (req, res) => {
    try {
      const { jid, message, text } = req.body;
      const cleanText = message || text || '';

      if (!jid || (!cleanText.trim() && !req.file)) {
        return res.status(400).json({ success: false, message: 'Parâmetro "jid" e ao menos um texto ou imagem são obrigatórios.' });
      }

      const result = await liveChatService.sendMessage(clientManager, jid, cleanText, io, req.file);
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
