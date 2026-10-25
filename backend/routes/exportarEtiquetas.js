// backend/routes/exportarEtiquetas.js
const express = require('express');
const router = express.Router();
const { ts } = require('../utils/logger');
const lidPhoneStore = require('../utils/lidPhoneStore');

// VERIFICAÇÃO OK: Aceitando 'handleCriticalClientErrorFunc' como parâmetro.
module.exports = function (clientManager, handleCriticalClientErrorFunc) {
  
  router.get(['/exportar-etiqueta/:labelId', '/api/exportar-etiqueta/:labelId'], async (req, res) => {
    const timestamp = ts();
    const originMessage = `GET /exportar-etiqueta/${req.params.labelId}`;

    try {
      const client = clientManager.getClient();
      if (!client || !client.info || !client.pupPage) {
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

      console.log(`[${timestamp}] [${originMessage}] Buscando contatos em lote para a etiqueta "${label.name}"...`);

      // Resolução em Lote (Batch) de Telefone Real e Nome para @c.us e @lid em uma única avaliação no navegador
      const localMap = Object.fromEntries(lidPhoneStore.map);
      const batchResult = await client.pupPage.evaluate(async (targetLabelId, localMap) => {
        try {
          const WAWebCollections = window.require ? window.require('WAWebCollections') : null;
          const WAWebApiContact = window.require ? window.require('WAWebApiContact') : null;
          const WAWebWidFactory = window.require ? window.require('WAWebWidFactory') : null;
          const LabelCollection = WAWebCollections?.Label || window.Store?.Label;

          if (!LabelCollection) {
            return { error: 'LabelCollection não disponível no Store do WhatsApp Web.' };
          }
          const targetLabel = LabelCollection.get(targetLabelId);
          if (!targetLabel) {
            return { error: 'Etiqueta não encontrada no Store do WhatsApp Web.' };
          }

          const items = targetLabel.labelItemCollection ? (targetLabel.labelItemCollection.getModelsArray ? targetLabel.labelItemCollection.getModelsArray() : []) : [];
          const contactsList = [];
          const newlyResolved = [];
          const seenPids = new Set();
          const seenNumbers = new Set();

          for (const item of items) {
            if (item.parentType !== 'Chat' || !item.parentId) continue;
            const pid = typeof item.parentId === 'string' ? item.parentId : item.parentId._serialized;
            if (!pid || pid.endsWith('@g.us') || seenPids.has(pid)) continue;
            seenPids.add(pid);

            const chat = WAWebCollections?.Chat ? WAWebCollections.Chat.get(pid) : (window.Store?.Chat ? window.Store.Chat.get(pid) : null);
            let contact = WAWebCollections?.Contact ? WAWebCollections.Contact.get(pid) : (window.Store?.Contact ? window.Store.Contact.get(pid) : null);

            let rawPhone = '';

            if (pid.endsWith('@lid')) {
              // 1. Tenta resolver via WAWebApiContact.getPhoneNumber(wid)
              try {
                const widObj = WAWebWidFactory ? WAWebWidFactory.createWid(pid) : null;
                if (widObj && WAWebApiContact && typeof WAWebApiContact.getPhoneNumber === 'function') {
                  const phoneRes = await WAWebApiContact.getPhoneNumber(widObj);
                  if (phoneRes) {
                    if (typeof phoneRes === 'string') rawPhone = phoneRes;
                    else if (phoneRes.user) rawPhone = phoneRes.user;
                    else if (phoneRes._serialized) rawPhone = phoneRes._serialized;
                  }
                }
              } catch (e) {}

              // 2. Fallbacks em Contact e Chat
              if (!rawPhone && contact?.phoneNumber) {
                rawPhone = typeof contact.phoneNumber === 'string' ? contact.phoneNumber : (contact.phoneNumber.user || '');
              }
              if (!rawPhone && chat?.contact?.phoneNumber) {
                rawPhone = typeof chat.contact.phoneNumber === 'string' ? chat.contact.phoneNumber : (chat.contact.phoneNumber.user || '');
              }

              // 3. Fallback no cofre local lidPhoneStore
              if (!rawPhone && localMap && localMap[pid]) {
                rawPhone = localMap[pid][0] || '';
              }
            } else {
              // @c.us normal
              const widObj = chat?.id || (WAWebWidFactory ? WAWebWidFactory.createWid(pid) : null);
              rawPhone = widObj?.user || pid.split('@')[0];
            }

            const numeroLimpo = (rawPhone || '').replace(/\D/g, '');

            // Se o número de telefone foi resolvido, busca o registro de contato @c.us para enriquecer o nome caso o @lid não possua
            if (numeroLimpo) {
              const cUsWid = numeroLimpo + '@c.us';
              const cUsContact = WAWebCollections?.Contact ? WAWebCollections.Contact.get(cUsWid) : (window.Store?.Contact ? window.Store.Contact.get(cUsWid) : null);
              if (cUsContact) {
                if (!contact) contact = cUsContact;
                else Object.assign(contact, cUsContact);
              }
            }

            // Extrair o nome mais completo disponível
            let nome = (chat?.name || contact?.name || contact?.pushname || contact?.verifiedName || contact?.formattedTitle || contact?.shortName || (localMap && localMap[pid] ? localMap[pid][1] : '') || '').trim();

            // Evitar que o nome seja igual ao LID ou ao número cru ou placeholder genérico
            if (nome === pid || nome === numeroLimpo || nome === 'Usuário desconhecido') {
              nome = contact?.pushname || contact?.name || (localMap && localMap[pid] ? localMap[pid][1] : '') || '';
            }

            // Descarta contatos sem telefone real válido
            if (numeroLimpo && numeroLimpo.length >= 8 && !seenNumbers.has(numeroLimpo)) {
              seenNumbers.add(numeroLimpo);
              contactsList.push({
                numero: numeroLimpo,
                nome: nome || ''
              });

              if (pid.endsWith('@lid') && (!localMap || !localMap[pid])) {
                newlyResolved.push([pid, numeroLimpo, nome || '']);
              }
            }
          }

          return { contacts: contactsList, newlyResolved };
        } catch (err) {
          return { error: err.message };
        }
      }, labelId, localMap);

      if (batchResult && batchResult.error) {
        console.warn(`[${timestamp}] [${originMessage}] ⚠️ Alerta no batch de contatos:`, batchResult.error);
      }

      if (batchResult && Array.isArray(batchResult.newlyResolved) && batchResult.newlyResolved.length > 0) {
        lidPhoneStore.setBatch(batchResult.newlyResolved);
      }

      const contatos = (batchResult && Array.isArray(batchResult.contacts)) ? batchResult.contacts : [];

      if (contatos.length === 0) {
        console.log(`[${timestamp}] [${originMessage}] 📭 Nenhum contato com número válido encontrado na etiqueta "${label.name}".`);
        return res.status(200).json({ success: true, message: `Nenhum contato encontrado na etiqueta "${label.name}".`, no_content: true });
      }

      console.log(`[${timestamp}] [${originMessage}] Gerando arquivo Excel com ${contatos.length} contatos...`);
      const ExcelJS = require('exceljs');
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
      console.log(`[${timestamp}] [${originMessage}] ✅ Arquivo gerado e enviado: contatos_etiqueta_${safeFileName}.xlsx (${contatos.length} contatos)`);

    } catch (err) {
      const errorTimestamp = ts();
      console.error(`[${errorTimestamp}] ❌ Erro em ${originMessage}:`, err);
      
      if (typeof handleCriticalClientErrorFunc === 'function') {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('target closed') || errMsg.includes('session closed') || errMsg.includes('protocol error')) {
          handleCriticalClientErrorFunc(err, originMessage);
        }
      }
      
      // Enviar a resposta de erro apenas se ela ainda não foi enviada.
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `Erro ao gerar o arquivo: ${err.message}` });
      }
    }
  });

  return router;
};