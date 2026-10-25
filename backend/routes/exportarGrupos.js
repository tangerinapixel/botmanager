// backend/routes/exportarGrupos.js
const express = require('express');
const router = express.Router();

module.exports = function (clientManager, handleCriticalClientErrorFunc) {

  // ROTA PARA LISTAR TODOS OS GRUPOS
  router.get('/api/grupos', async (req, res) => {
    try {
      const client = clientManager.getClient();
      if (!client || !client.info) {
        return res.status(503).json({ success: false, message: 'Cliente WhatsApp não está pronto.' });
      }
      const chats = await client.getChats();
      const grupos = chats
        .filter(chat => chat.isGroup)
        .map(chat => ({ id: chat.id._serialized, name: chat.name }));
      
      res.json({ success: true, grupos: grupos });
    } catch (err) {
      console.error('❌ Erro ao listar grupos:', err);
      if (typeof handleCriticalClientErrorFunc === 'function') {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('target closed') || errMsg.includes('session closed') || errMsg.includes('protocol error')) {
          handleCriticalClientErrorFunc(err, 'GET /api/grupos');
        }
      }
      if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Erro ao buscar grupos.' });
      }
    }
  });

  // ROTA PARA EXPORTAR OS CONTATOS DE UM GRUPO ESPECÍFICO
  router.get('/api/exportar-grupo/:groupId', async (req, res) => {
    const timestamp = new Date().toISOString();
    const originMessage = `GET /api/exportar-grupo/${req.params.groupId}`;

    try {
      const client = clientManager.getClient();
      if (!client || !client.info) {
        console.warn(`[${timestamp}] [${originMessage}] Tentativa de exportar com cliente não pronto.`);
        return res.status(503).json({ success: false, message: 'Cliente WhatsApp ainda não está pronto.' });
      }
      
      const groupId = decodeURIComponent(req.params.groupId);
      const chat = await client.getChatById(groupId);

      if (!chat || !chat.isGroup) {
        return res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
      }

      console.log(`[${timestamp}] [${originMessage}] Gerando arquivo Excel para o grupo "${chat.name}"...`);
      let participantsList = [];
      try {
        if (Array.isArray(chat.groupMetadata?.participants)) {
          participantsList = chat.groupMetadata.participants;
        } else if (Array.isArray(chat._data?.groupMetadata?.participants)) {
          participantsList = chat._data.groupMetadata.participants;
        } else if (Array.isArray(chat.participants)) {
          participantsList = chat.participants;
        }
      } catch (err) {
        console.warn(`[${timestamp}] [${originMessage}] Aviso ao obter participantes do grupo:`, err.message);
        participantsList = [];
      }

      const contatos = [];
      for (const participante of participantsList) {
        if (!participante || !participante.id) continue;
        contatos.push({
          numero: participante.id.user || (typeof participante.id._serialized === 'string' ? participante.id._serialized.replace(/@.*$/, '') : ''),
          nome: participante.name || participante.pushname || ''
        });
      }

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      // AJUSTE 1: Limita o nome da aba da planilha para 31 caracteres para evitar o aviso do ExcelJS
      const safeSheetName = `Contatos - ${chat.name}`.substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);
      
      sheet.columns = [
        { header: 'Telefone', key: 'numero', width: 20 },
        { header: 'Nome Salvo', key: 'nome', width: 30 }
      ];
      sheet.addRows(contatos);

      // AJUSTE 2: Garante aspas no nome do arquivo para maior compatibilidade
      // CÓDIGO CORRIGIDO
const originalName = chat.name || 'sem_nome';
const safeFileName = originalName.toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^\w-]+/g, '')
  .replace(/--+/g, '-');

res.setHeader('Content-Disposition', `attachment; filename="contatos_grupo_${safeFileName}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`[${timestamp}] [${originMessage}] ✅ Arquivo gerado e enviado.`);
      
    } catch (err) {
      console.error(`❌ Erro em ${originMessage}:`, err);
      if (typeof handleCriticalClientErrorFunc === 'function') {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('target closed') || errMsg.includes('session closed') || errMsg.includes('protocol error')) {
          handleCriticalClientErrorFunc(err, originMessage);
        }
      }
      
      // AJUSTE 3: Verifica se os cabeçalhos já foram enviados antes de mandar uma resposta de erro
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `Erro ao gerar o arquivo de exportação: ${err.message}` });
      }
    }
  });

  return router;
};