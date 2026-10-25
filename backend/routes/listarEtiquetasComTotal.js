const express = require('express');
const router = express.Router();
const { ts } = require('../utils/logger');
const lidPhoneStore = require('../utils/lidPhoneStore');

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

      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] Buscando contagem de contatos por etiqueta (consistência estrita por telefone)...`);

      // 1. Otimização de alta performance: contagem direta em lote no navegador com resolução estrita de telefone
      try {
        const localMap = Object.fromEntries(lidPhoneStore.map);
        const evalResult = await client.pupPage.evaluate(async (localMap) => {
          try {
            const WAWebCollections = window.require ? window.require('WAWebCollections') : null;
            const WAWebApiContact = window.require ? window.require('WAWebApiContact') : null;
            const WAWebWidFactory = window.require ? window.require('WAWebWidFactory') : null;
            const LabelCol = WAWebCollections?.Label || window.Store?.Label;
            if (!LabelCol) return null;

            const labels = LabelCol.getModelsArray ? LabelCol.getModelsArray() : [];
            const resultado = [];
            const newlyResolved = [];

            for (const label of labels) {
              let count = 0;
              if (label.labelItemCollection) {
                const items = label.labelItemCollection.getModelsArray ? label.labelItemCollection.getModelsArray() : [];
                const seenPids = new Set();
                const seenNumbers = new Set();

                for (const item of items) {
                  if (item.parentType !== 'Chat' || !item.parentId) continue;
                  const pid = typeof item.parentId === 'string' ? item.parentId : item.parentId._serialized;
                  // Ignora grupos (@g.us) e duplicatas de chat
                  if (!pid || pid.endsWith('@g.us') || seenPids.has(pid)) continue;
                  seenPids.add(pid);

                  let rawPhone = '';

                  if (pid.endsWith('@lid')) {
                    // 1. Tenta resolver via WAWebApiContact.getPhoneNumber(widObj)
                    try {
                      const widObj = WAWebWidFactory ? WAWebWidFactory.createWid(pid) : null;
                      if (widObj && WAWebApiContact && typeof WAWebApiContact.getPhoneNumber === 'function') {
                        const phoneRes = await WAWebApiContact.getPhoneNumber(widObj);
                        if (phoneRes) {
                          rawPhone = typeof phoneRes === 'string' ? phoneRes : (phoneRes.user || phoneRes._serialized || '');
                        }
                      }
                    } catch (e) {}

                    // 2. Fallbacks em Contact e Chat
                    if (!rawPhone) {
                      const contact = WAWebCollections?.Contact ? WAWebCollections.Contact.get(pid) : (window.Store?.Contact ? window.Store.Contact.get(pid) : null);
                      if (contact?.phoneNumber) {
                        rawPhone = typeof contact.phoneNumber === 'string' ? contact.phoneNumber : (contact.phoneNumber.user || '');
                      }
                    }
                    if (!rawPhone) {
                      const chat = WAWebCollections?.Chat ? WAWebCollections.Chat.get(pid) : (window.Store?.Chat ? window.Store.Chat.get(pid) : null);
                      if (chat?.contact?.phoneNumber) {
                        rawPhone = typeof chat.contact.phoneNumber === 'string' ? chat.contact.phoneNumber : (chat.contact.phoneNumber.user || '');
                      }
                    }

                    // 3. Fallback no cofre local lidPhoneStore
                    if (!rawPhone && localMap && localMap[pid]) {
                      rawPhone = localMap[pid][0] || '';
                    }
                  } else {
                    // Contato individual normal (@c.us)
                    const chat = WAWebCollections?.Chat ? WAWebCollections.Chat.get(pid) : (window.Store?.Chat ? window.Store.Chat.get(pid) : null);
                    const widObj = chat?.id || (WAWebWidFactory ? WAWebWidFactory.createWid(pid) : null);
                    rawPhone = widObj?.user || pid.split('@')[0];
                  }

                  const numeroLimpo = (rawPhone || '').replace(/\D/g, '');
                  if (numeroLimpo && numeroLimpo.length >= 8 && !seenNumbers.has(numeroLimpo)) {
                    seenNumbers.add(numeroLimpo);
                    count++;

                    if (pid.endsWith('@lid') && (!localMap || !localMap[pid])) {
                      newlyResolved.push([pid, numeroLimpo]);
                    }
                  }
                }
              }

              resultado.push({
                id: label.id,
                nome: label.name,
                totalContatos: count
              });
            }

            return { contagens: resultado, newlyResolved };
          } catch (e) {
            return null;
          }
        }, localMap);

        if (evalResult && Array.isArray(evalResult.contagens) && evalResult.contagens.length > 0) {
          if (Array.isArray(evalResult.newlyResolved) && evalResult.newlyResolved.length > 0) {
            lidPhoneStore.setBatch(evalResult.newlyResolved);
          }
          console.log(`[${timestamp}] [GET /api/etiquetas-com-total] ✅ ${evalResult.contagens.length} etiquetas processadas com consistência estrita.`);
          return res.json({ etiquetas: evalResult.contagens });
        }
      } catch (evalErr) {
        console.warn(`[${timestamp}] [GET /api/etiquetas-com-total] ⚠️ Consulta direta falhou (${evalErr.message}), recorrendo ao fallback padrão.`);
      }

      // 2. Fallback padrão via getLabels com validação estrita de telefone
      const labels = await client.getLabels();
      console.log(`[${timestamp}] [GET /api/etiquetas-com-total] ${labels.length} labels encontradas via fallback. Processando chats...`);

      const resultado = await Promise.all(labels.map(async (label) => {
        try {
          const chats = await label.getChats();
          const seenNumbers = new Set();
          let count = 0;

          for (const chat of chats) {
            if (!chat || !chat.id || chat.isGroup) continue;
            const pid = chat.id._serialized || '';
            if (pid.endsWith('@g.us')) continue;

            let phone = '';
            if (pid.endsWith('@lid')) {
              phone = lidPhoneStore.getPhone(pid);
              if (!phone && chat.contact?.number) {
                phone = chat.contact.number;
              }
            } else {
              phone = chat.id.user || pid.split('@')[0];
            }

            const cleanPhone = (phone || '').replace(/\D/g, '');
            if (cleanPhone && cleanPhone.length >= 8 && !seenNumbers.has(cleanPhone)) {
              seenNumbers.add(cleanPhone);
              count++;
            }
          }

          return {
            id: label.id,
            nome: label.name,
            totalContatos: count
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
      
      res.status(500).json({ 
        error: 'Erro ao buscar etiquetas.', 
        details: err.message
      });
    }
  });

  return router;
};