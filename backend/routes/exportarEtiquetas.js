// backend/routes/exportarEtiquetas.js
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');

// VERIFICAÇÃO OK: Aceitando 'handleCriticalClientErrorFunc' como parâmetro.
module.exports = function (client, handleCriticalClientErrorFunc) {
  
  router.get('/exportar-etiqueta/:labelId', async (req, res) => {
    const timestamp = new Date().toISOString();
    const originMessage = `GET /exportar-etiqueta/${req.params.labelId}`;

    try {
      // VERIFICAÇÃO OK: Checagem de prontidão do cliente padronizada.
      if (!client.info || !client.pupPage) {
        console.warn(`[${timestamp}] [${originMessage}] Tentativa de exportar com cliente não pronto.`);
        return res.status(503).json({ success: false, message: 'Cliente WhatsApp ainda não está pronto. Por favor, aguarde e tente novamente.' });
      }

      const labelId = decodeURIComponent(req.params.labelId);
      console.log(`[${timestamp}] [${originMessage}] 🔍 ID da etiqueta recebido:`, labelId);

      const labels = await client.getLabels();
      const label = labels.find(l => l.id === labelId);
      
      if (!label) {
        console.warn(`[${timestamp}] [${originMessage}] ⚠️ Etiqueta com ID "${labelId}" não encontrada.`);
        return res.status(404).json({ success: false, message: 'Etiqueta não encontrada.' });
      }

      console.log(`[${timestamp}] [${originMessage}] Buscando chats para a etiqueta "${label.name}"...`);
      const chats = await label.getChats();
      const contatos = [];

      // VERIFICAÇÃO OK: Processamento de contatos melhorado e com tratamento de erro individual.
      await Promise.all(chats.map(async (chat) => {
        try {
          if (!chat.isGroup && chat.id && chat.id.user) {
            const contato = await chat.getContact();
            let nome = '';
            if (contato.pushname && !contato.pushname.includes(contato.number)) {
              nome = contato.pushname;
            } else if (contato.name && !contato.name.includes(contato.number)) {
              nome = contato.name;
            }
            const numero = chat.id.user.replace(/\D/g, '');
            contatos.push({ numero, nome });
          }
        } catch (contactErr) {
          console.warn(`[${timestamp}] [${originMessage}] ⚠️ Erro ao processar um contato (${chat.id._serialized}):`, contactErr.message);
        }
      }));

      if (contatos.length === 0) {
        console.log(`[${timestamp}] [${originMessage}] 📭 Nenhum contato encontrado na etiqueta "${label.name}".`);
        return res.status(200).json({ success: true, message: `Nenhum contato encontrado na etiqueta "${label.name}".`, no_content: true });
      }

      console.log(`[${timestamp}] [${originMessage}] Gerando arquivo Excel com ${contatos.length} contatos...`);
      const workbook = new ExcelJS.Workbook();
      // VERIFICAÇÃO OK: Limita o nome da aba da planilha para 31 caracteres para evitar o aviso do ExcelJS.
      const safeSheetName = `Contatos - ${label.name}`.substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);
      
      sheet.columns = [
        { header: 'Telefone', key: 'numero', width: 20 },
        { header: 'Nome do Contato', key: 'nome', width: 30 }
      ];
      sheet.addRows(contatos);

      // VERIFICAÇÃO OK: Cabeçalhos de download estão corretos e com aspas no nome do arquivo.
      const safeFileName = label.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="contatos_etiqueta_${safeFileName}.xlsx"`);

      // VERIFICAÇÃO OK: Envio do arquivo como resposta.
      await workbook.xlsx.write(res);
      res.end();
      console.log(`[${timestamp}] [${originMessage}] ✅ Arquivo gerado e enviado: contatos_etiqueta_${safeFileName}.xlsx`);

    } catch (err) {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] ❌ Erro em ${originMessage}:`, err);
      
      // VERIFICAÇÃO OK: Chamada da função centralizada de tratamento de erro crítico.
      if (typeof handleCriticalClientErrorFunc === 'function') {
        handleCriticalClientErrorFunc(err, originMessage);
      }
      
      // PEQUENA CORREÇÃO: Enviar a resposta de erro apenas se ela ainda não foi enviada.
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `Erro ao gerar o arquivo: ${err.message}` });
      }
    }
  });

  return router;
};