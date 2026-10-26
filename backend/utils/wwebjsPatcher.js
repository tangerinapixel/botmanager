class WWebJSPatcher {
    static async applyChatsPatch(client) {
        try {
            if (client && client.pupPage && !client.pupPage.isClosed()) {
                await client.pupPage.evaluate(() => {
                    // Patch 1: getChatModel resiliente e estritamente plano (imune a erro CDP -32000 e falha de IndexedDB)
                    if (window.WWebJS) {
                        window.WWebJS.getChatModel = async (chat, options = {}) => {
                            if (!chat) return null;
                            try {
                                const serializedId = chat.id?._serialized || (typeof chat.id === 'string' ? chat.id : '');
                                if (!serializedId) return null;

                                const isGroup = Boolean(
                                    serializedId.endsWith('@g.us') ||
                                    chat.id?.server === 'g.us' ||
                                    chat.isGroup
                                );
                                const isBroadcast = Boolean(chat.isBroadcast || serializedId.endsWith('@broadcast'));
                                const isChannel = Boolean(options?.isChannel || /@\w*newsletter\b/.test(serializedId));

                                let title = chat.formattedTitle || chat.name || '';
                                if (!title) {
                                    try {
                                        title = chat.contact?.name || chat.contact?.pushname || chat._data?.notifyName || '';
                                    } catch (_) {}
                                }
                                if (!title) {
                                    title = isGroup ? 'Grupo' : (isBroadcast ? 'Lista de Transmissão' : '');
                                }

                                const time = Number(chat.t || chat.timestamp || Math.floor(Date.now() / 1000));

                                // Metadados de grupo estritamente planos
                                let cleanGroupMetadata = null;
                                if (isGroup) {
                                    let rawParts = [];
                                    try {
                                        const gm = chat.groupMetadata || chat._data?.groupMetadata;
                                        if (gm) {
                                            if (typeof gm.participants?.getModelsArray === 'function') {
                                                rawParts = gm.participants.getModelsArray();
                                            } else if (Array.isArray(gm.participants)) {
                                                rawParts = gm.participants;
                                            } else if (Array.isArray(gm.participants?._models)) {
                                                rawParts = gm.participants._models;
                                            }
                                        }
                                        if (rawParts.length === 0 && Array.isArray(chat.participants)) {
                                            rawParts = chat.participants;
                                        }
                                    } catch (_) {}

                                    const cleanParticipants = (Array.isArray(rawParts) ? rawParts : []).map((p, idx) => {
                                        const pJid = p?.id?._serialized || (typeof p?.id === 'string' ? p.id : (p?.id?.user ? `${p.id.user}@c.us` : `p_${idx}@c.us`));
                                        return {
                                            id: {
                                                _serialized: pJid,
                                                server: p?.id?.server || 'c.us',
                                                user: p?.id?.user || pJid.replace(/@.*$/, '')
                                            },
                                            isAdmin: Boolean(p?.isAdmin),
                                            isSuperAdmin: Boolean(p?.isSuperAdmin)
                                        };
                                    });

                                    const gm = chat.groupMetadata || chat._data?.groupMetadata || {};
                                    const ownerJid = gm.owner?._serialized || (typeof gm.owner === 'string' ? gm.owner : (gm.owner?.user ? `${gm.owner.user}@c.us` : null));

                                    cleanGroupMetadata = {
                                        id: {
                                            _serialized: serializedId,
                                            server: 'g.us',
                                            user: serializedId.replace(/@.*$/, '')
                                        },
                                        creation: Number(gm.creation || time),
                                        owner: ownerJid ? {
                                            _serialized: ownerJid,
                                            server: 'c.us',
                                            user: ownerJid.replace(/@.*$/, '')
                                        } : null,
                                        desc: typeof gm.desc === 'string' ? gm.desc : '',
                                        descId: gm.descId || null,
                                        descTime: Number(gm.descTime || 0),
                                        descOwner: gm.descOwner?._serialized || (typeof gm.descOwner === 'string' ? gm.descOwner : null),
                                        restrict: Boolean(gm.restrict),
                                        announce: Boolean(gm.announce),
                                        participants: cleanParticipants,
                                        pendingParticipants: [],
                                        pastParticipants: []
                                    };
                                }

                                // Metadados de canal estritamente planos
                                let cleanChannelMetadata = null;
                                if (isChannel && chat.newsletterMetadata) {
                                    try {
                                        const nm = chat.newsletterMetadata;
                                        cleanChannelMetadata = {
                                            id: serializedId,
                                            creationTime: Number(nm.creationTime || time),
                                            name: nm.name || title,
                                            description: nm.description || '',
                                            subscribersCount: Number(nm.subscribersCount || 0)
                                        };
                                    } catch (_) {}
                                }

                                // Extrai preview seguro da última mensagem sem depender de consulta síncrona a lastReceivedKey no IndexedDB
                                let lastMsg = null;
                                if (chat.lastMessage) {
                                    lastMsg = {
                                        id: chat.lastMessage.id?._serialized || String(chat.lastMessage.id || ''),
                                        body: typeof chat.lastMessage.body === 'string' ? chat.lastMessage.body : '',
                                        type: chat.lastMessage.type || 'chat',
                                        timestamp: Number(chat.lastMessage.t || chat.lastMessage.timestamp || 0),
                                        fromMe: Boolean(chat.lastMessage.fromMe),
                                        author: chat.lastMessage.author || ''
                                    };
                                }

                                const isParentGroup = Boolean(chat.isParentGroup || chat._data?.isParentGroup || chat.groupMetadata?.isParentGroup || chat.groupMetadata?.groupType === 'COMMUNITY' || chat.groupType === 'COMMUNITY');
                                const groupType = String(chat.groupType || chat.groupMetadata?.groupType || '');
                                const isCommunityAnnouncementGroup = Boolean(chat.isCommunityAnnouncementGroup || chat.groupMetadata?.isCommunityAnnouncementGroup || chat.groupMetadata?.groupType === 'LINKED_ANNOUNCEMENT_GROUP');
                                const isCommunity = Boolean(chat.isCommunity || chat._data?.isCommunity || isParentGroup || isCommunityAnnouncementGroup);

                                return {
                                    id: {
                                        _serialized: serializedId,
                                        server: isGroup ? 'g.us' : (chat.id?.server || 'c.us'),
                                        user: chat.id?.user || serializedId.replace(/@.*$/, '')
                                    },
                                    name: title,
                                    formattedTitle: title,
                                    isGroup: isGroup,
                                    isBroadcast: isBroadcast,
                                    isChannel: isChannel,
                                    isParentGroup: isParentGroup,
                                    isCommunity: isCommunity,
                                    isCommunityAnnouncementGroup: isCommunityAnnouncementGroup,
                                    groupType: groupType,
                                    isReadOnly: Boolean(chat.isReadOnly || cleanGroupMetadata?.announce),
                                    unreadCount: Number(chat.unreadCount || 0),
                                    timestamp: time,
                                    t: time,
                                    pinned: Boolean(chat.pinned || chat.pin),
                                    isPinned: Boolean(chat.pinned || chat.pin),
                                    isMuted: Boolean(chat.isMuted || (chat.mute && chat.mute.expiration !== 0)),
                                    mute: { expiration: chat.mute?.expiration || 0 },
                                    groupMetadata: cleanGroupMetadata,
                                    channelMetadata: cleanChannelMetadata,
                                    lastMessage: lastMsg
                                };
                            } catch (err) {
                                console.error('[WWebJS Patch] Erro ao construir DTO plano em getChatModel:', err.message);
                                const serializedId = chat?.id?._serialized || (typeof chat?.id === 'string' ? chat.id : '');
                                const isGroup = Boolean((serializedId && serializedId.endsWith('@g.us')) || chat?.id?.server === 'g.us' || chat?.isGroup);
                                const isParentGroup = Boolean(chat?.isParentGroup || chat?._data?.isParentGroup || chat?.groupMetadata?.isParentGroup || chat?.groupMetadata?.groupType === 'COMMUNITY' || chat?.groupType === 'COMMUNITY');
                                const groupType = String(chat?.groupType || chat?.groupMetadata?.groupType || '');
                                const isCommunityAnnouncementGroup = Boolean(chat?.isCommunityAnnouncementGroup || chat?.groupMetadata?.isCommunityAnnouncementGroup || chat?.groupMetadata?.groupType === 'LINKED_ANNOUNCEMENT_GROUP');
                                const isCommunity = Boolean(chat?.isCommunity || chat?._data?.isCommunity || isParentGroup || isCommunityAnnouncementGroup);

                                return {
                                    id: {
                                        _serialized: serializedId,
                                        server: isGroup ? 'g.us' : 'c.us',
                                        user: serializedId.replace(/@.*$/, '')
                                    },
                                    name: chat?.formattedTitle || chat?.name || (isGroup ? 'Grupo' : ''),
                                    formattedTitle: chat?.formattedTitle || chat?.name || (isGroup ? 'Grupo' : ''),
                                    isGroup: isGroup,
                                    isParentGroup: isParentGroup,
                                    isCommunity: isCommunity,
                                    isCommunityAnnouncementGroup: isCommunityAnnouncementGroup,
                                    groupType: groupType,
                                    isReadOnly: Boolean(chat?.isReadOnly),
                                    unreadCount: Number(chat?.unreadCount || 0),
                                    timestamp: Number(chat?.t || Math.floor(Date.now() / 1000)),
                                    t: Number(chat?.t || Math.floor(Date.now() / 1000)),
                                    groupMetadata: isGroup ? {
                                        id: { _serialized: serializedId, server: 'g.us', user: serializedId.replace(/@.*$/, '') },
                                        creation: Math.floor(Date.now() / 1000),
                                        owner: null,
                                        desc: '',
                                        announce: false,
                                        restrict: false,
                                        participants: [],
                                        pendingParticipants: [],
                                        pastParticipants: []
                                    } : null,
                                    lastMessage: null
                                };
                            }
                        };
                        window.WWebJS.getChatModel.isPatched = true;
                    }

                    // Patch 2: getChats resiliente no navegador (DTO plano imune a erro CDP -32000)
                    if (window.WWebJS) {
                        window.WWebJS.getChats = async () => {
                            try {
                                let chats = null;
                                try {
                                    const collections = window.require('WAWebCollections');
                                    if (collections && collections.Chat) {
                                        if (typeof collections.Chat.getModelsArray === 'function') {
                                            chats = collections.Chat.getModelsArray();
                                        } else if (Array.isArray(collections.Chat.models)) {
                                            chats = collections.Chat.models;
                                        } else if (typeof collections.Chat.toArray === 'function') {
                                            chats = collections.Chat.toArray();
                                        }
                                    }
                                } catch (_) {}

                                if (!chats || !Array.isArray(chats)) {
                                    try {
                                        const chatCol = window.require('WAWebChatCollection');
                                        const collectionInstance = chatCol && (chatCol.ChatCollection || chatCol.default || chatCol);
                                        if (collectionInstance) {
                                            if (typeof collectionInstance.getModelsArray === 'function') {
                                                chats = collectionInstance.getModelsArray();
                                            } else if (Array.isArray(collectionInstance.models)) {
                                                chats = collectionInstance.models;
                                            }
                                        }
                                    } catch (_) {}
                                }

                                if (!chats || !Array.isArray(chats)) {
                                    try {
                                        if (window.Store && window.Store.Chat) {
                                            if (typeof window.Store.Chat.getModelsArray === 'function') {
                                                chats = window.Store.Chat.getModelsArray();
                                            } else if (Array.isArray(window.Store.Chat.models)) {
                                                chats = window.Store.Chat.models;
                                            }
                                        }
                                    } catch (_) {}
                                }

                                if (!Array.isArray(chats) || chats.length === 0) {
                                    return [];
                                }

                                const cleanDTOs = [];
                                for (let i = 0; i < chats.length; i++) {
                                    const chat = chats[i];
                                    if (!chat || !chat.id) continue;
                                    const serializedId = chat.id._serialized || (typeof chat.id === 'string' ? chat.id : '');
                                    if (!serializedId) continue;

                                    const isGroup = Boolean(serializedId.endsWith('@g.us') || chat.id.server === 'g.us' || chat.isGroup);
                                    const isBroadcast = Boolean(chat.isBroadcast || serializedId.endsWith('@broadcast'));
                                    const title = chat.formattedTitle || chat.name || (isGroup ? 'Grupo' : '');
                                    const time = Number(chat.t || chat.timestamp || 0);

                                    let lastMsg = null;
                                    if (chat.lastMessage) {
                                        lastMsg = {
                                            id: chat.lastMessage.id?._serialized || String(chat.lastMessage.id || ''),
                                            body: typeof chat.lastMessage.body === 'string' ? chat.lastMessage.body : '',
                                            type: chat.lastMessage.type || 'chat',
                                            timestamp: Number(chat.lastMessage.t || chat.lastMessage.timestamp || 0),
                                            fromMe: Boolean(chat.lastMessage.fromMe),
                                            author: chat.lastMessage.author || ''
                                        };
                                    }

                                    let participantCount = 0;
                                    if (isGroup) {
                                        if (Array.isArray(chat.groupMetadata?.participants)) {
                                            participantCount = chat.groupMetadata.participants.length;
                                        } else if (Array.isArray(chat._data?.groupMetadata?.participants)) {
                                            participantCount = chat._data.groupMetadata.participants.length;
                                        } else if (Array.isArray(chat.participants)) {
                                            participantCount = chat.participants.length;
                                        }
                                    }

                                    const isParentGroup = Boolean(chat.isParentGroup || chat._data?.isParentGroup || chat.groupMetadata?.isParentGroup || chat.groupMetadata?.groupType === 'COMMUNITY' || chat.groupType === 'COMMUNITY');
                                    const groupType = String(chat.groupType || chat.groupMetadata?.groupType || '');
                                    const isCommunityAnnouncementGroup = Boolean(chat.isCommunityAnnouncementGroup || chat.groupMetadata?.isCommunityAnnouncementGroup || chat.groupMetadata?.groupType === 'LINKED_ANNOUNCEMENT_GROUP');
                                    const isCommunity = Boolean(chat.isCommunity || chat._data?.isCommunity || isParentGroup || isCommunityAnnouncementGroup);

                                    cleanDTOs.push({
                                        id: {
                                            _serialized: serializedId,
                                            server: isGroup ? 'g.us' : (chat.id.server || 'c.us'),
                                            user: chat.id.user || serializedId.replace(/@.*$/, '')
                                        },
                                        name: title,
                                        formattedTitle: title,
                                        isGroup: isGroup,
                                        isBroadcast: isBroadcast,
                                        isParentGroup: isParentGroup,
                                        isCommunity: isCommunity,
                                        isCommunityAnnouncementGroup: isCommunityAnnouncementGroup,
                                        groupType: groupType,
                                        unreadCount: Number(chat.unreadCount || 0),
                                        timestamp: time,
                                        t: time,
                                        pinned: Boolean(chat.pinned),
                                        isPinned: Boolean(chat.pinned),
                                        isReadOnly: Boolean(chat.isReadOnly),
                                        isMuted: Boolean(chat.isMuted || (chat.mute && chat.mute.expiration !== 0)),
                                        mute: { expiration: chat.mute?.expiration || 0 },
                                        groupMetadata: isGroup ? {
                                            participants: new Array(participantCount).fill(null).map((_, idx) => ({ id: { _serialized: 'p_' + idx } }))
                                        } : null,
                                        contact: {
                                            name: chat.contact?.name || '',
                                            pushname: chat.contact?.pushname || ''
                                        },
                                        pushname: chat.pushname || '',
                                        _data: {
                                            notifyName: chat._data?.notifyName || chat.pushname || '',
                                            isParentGroup: isParentGroup
                                        },
                                        lastMessage: lastMsg
                                    });
                                }
                                return cleanDTOs;
                            } catch (criticalErr) {
                                console.error('[WWebJS Patch] Falha crítica em window.WWebJS.getChats:', criticalErr.message);
                                return [];
                            }
                        };
                    }

                    // Patch 4: Correção para envio de mídia no WhatsApp Web v2.3000+
                    // Elimina 'Data passed to getter must include an id property' causado pelo spread de __x_id do MediaData
                    // e garante que imagens sejam enviadas estritamente com type: 'image' (e nunca 'document')
                    if (window.WWebJS && !window.WWebJS._processMediaDataPatched) {
                        const origProcessMediaData = window.WWebJS.processMediaData;
                        if (typeof origProcessMediaData === 'function') {
                            window.WWebJS.processMediaData = async function(mediaInfo, options = {}) {
                                if (mediaInfo) {
                                    if (!mediaInfo.mimetype || mediaInfo.mimetype === 'null') {
                                        const ext = (mediaInfo.filename || '').split('.').pop().toLowerCase();
                                        if (ext === 'png') mediaInfo.mimetype = 'image/png';
                                        else if (ext === 'webp') mediaInfo.mimetype = 'image/webp';
                                        else if (ext === 'gif') mediaInfo.mimetype = 'image/gif';
                                        else mediaInfo.mimetype = 'image/jpeg';
                                    }
                                }
                                const mediaData = await origProcessMediaData.call(this, mediaInfo, options);
                                if (mediaData) {
                                    try {
                                        delete mediaData.__x_id;
                                        delete mediaData.revisionNumber;
                                        delete mediaData.parent;
                                        delete mediaData.collection;
                                    } catch (_) {}

                                    if (mediaInfo && mediaInfo.mimetype && mediaInfo.mimetype.startsWith('image/') && !options?.forceDocument) {
                                        mediaData.type = 'image';
                                        if (mediaData.attributes) mediaData.attributes.type = 'image';
                                        if (typeof mediaData.set === 'function') {
                                            try { mediaData.set('type', 'image'); } catch (_) {}
                                        }
                                    }
                                }
                                return mediaData;
                            };
                            window.WWebJS._processMediaDataPatched = true;
                        }
                    }

                    // Patch 5: Resiliência no retorno do sendMessage no WhatsApp Web v2.3000+
                    // Garante que o retorno nunca seja undefined se a mensagem foi enviada ao chat
                    if (window.WWebJS && !window.WWebJS._sendMessagePatched) {
                        const origSendMessage = window.WWebJS.sendMessage;
                        if (typeof origSendMessage === 'function') {
                            window.WWebJS.sendMessage = async function(chat, content, options = {}) {
                                const result = await origSendMessage.call(this, chat, content, options);
                                if (!result && chat && chat.msgs) {
                                    const msgs = chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : [];
                                    const lastSent = msgs.slice(-1).find(m => m?.id?.fromMe);
                                    if (lastSent) return lastSent;
                                }
                                return result;
                            };
                            window.WWebJS._sendMessagePatched = true;
                        }
                    }
                });
            }

            // Patch 3: Substituição robusta e de alta performance de client.getChats no Node.js
            if (client && !client._getChatsOverridden) {
                client.getChats = async function() {
                    try {
                        if (!client.pupPage || client.pupPage.isClosed()) {
                            return [];
                        }

                        const rawChats = await client.pupPage.evaluate(async () => {
                            if (window.WWebJS && typeof window.WWebJS.getChats === 'function') {
                                return window.WWebJS.getChats();
                            }
                            return [];
                        });

                        if (!Array.isArray(rawChats)) {
                            return [];
                        }

                        const ChatFactory = require('whatsapp-web.js/src/factories/ChatFactory');
                        return rawChats.map(c => {
                            const chatInstance = ChatFactory.create(client, c);
                            if (chatInstance) {
                                chatInstance.isParentGroup = Boolean(c.isParentGroup);
                                chatInstance.groupType = c.groupType || '';
                                chatInstance.isCommunity = Boolean(c.isCommunity);
                                chatInstance.isCommunityAnnouncementGroup = Boolean(c.isCommunityAnnouncementGroup);
                                chatInstance.groupMetadata = c.groupMetadata || chatInstance.groupMetadata;
                                chatInstance._data = c._data || chatInstance._data;
                            }
                            return chatInstance;
                        });
                    } catch (err) {
                        console.error('[WWebJS Patch] Erro em client.getChats:', err.message);
                        return [];
                    }
                };
                client._getChatsOverridden = true;
            }
        } catch (err) {
            console.log('[WWebJS Patch] Erro ao aplicar patch do getChats/getChatModel:', err.message);
        }
    }
}

module.exports = WWebJSPatcher;
