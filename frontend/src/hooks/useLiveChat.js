// frontend/src/hooks/useLiveChat.js
// Custom hook para gerenciamento de estado e comunicação em tempo real da Central de Mensagens

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import socket from '../socket/socket';
import { useNotifier } from '../context/Notifier';

const API_BASE = 'http://localhost:5005';

// Cache em memória no nível de módulo para persistência estrita durante toda a vida útil da aplicação
const liveChatMemoryCache = {
  chats: [],
  activeJid: null,
  messages: [],
  searchTerm: '',
  chatFilter: 'all',
  isBackendReady: true,
  messagesCacheByJid: new Map(),
};

// Tipos de mensagem de protocolo e notificações internas do WhatsApp Web que nunca devem ser renderizados
const SYSTEM_MESSAGE_TYPES = new Set([
  'e2e_notification',
  'notification_template',
  'ciphertext',
  'protocol',
  'gp2',
  'broadcast_notification',
  'call_log',
  'revoked',
]);

// Tipos de mídia válidos que devem ser preservados mesmo quando o corpo (legenda) for vazio
const VALID_MEDIA_TYPES = new Set([
  'image',
  'video',
  'audio',
  'ptt',
  'document',
  'sticker',
  'location',
  'vcard',
  'multi_vcard',
]);

/**
 * Valida se uma mensagem recebida via API ou Socket.IO é renderizável e legítima.
 * Rejeita mensagens da lista negra de sistema e mensagens sem texto e sem mídia.
 */
export function isRenderableMessage(m) {
  if (!m) return false;
  const type = m.type || 'chat';
  if (SYSTEM_MESSAGE_TYPES.has(type)) {
    return false;
  }
  const isMedia = Boolean(m.hasMedia || VALID_MEDIA_TYPES.has(type));
  const hasText = Boolean(typeof m.body === 'string' && m.body.trim().length > 0);
  return isMedia || hasText;
}

export function useLiveChat() {
  const notify = useNotifier();
  
  const [chats, setChatsState] = useState(() => liveChatMemoryCache.chats);
  const [activeJid, setActiveJidState] = useState(() => liveChatMemoryCache.activeJid);
  const [messages, setMessagesState] = useState(() => liveChatMemoryCache.messages);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTermState] = useState(() => liveChatMemoryCache.searchTerm);
  const [chatFilter, setChatFilterState] = useState(() => liveChatMemoryCache.chatFilter);
  const [isBackendReady, setIsBackendReadyState] = useState(() => liveChatMemoryCache.isBackendReady);

  // Setters sincronizados com o cache em memória
  const setChats = useCallback((updater) => {
    setChatsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      liveChatMemoryCache.chats = next;
      return next;
    });
  }, []);

  const setActiveJid = useCallback((val) => {
    liveChatMemoryCache.activeJid = val;
    setActiveJidState(val);
  }, []);

  const setMessages = useCallback((updater) => {
    setMessagesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      liveChatMemoryCache.messages = next;
      if (activeJidRef.current) {
        liveChatMemoryCache.messagesCacheByJid.set(activeJidRef.current, next);
      }
      return next;
    });
  }, []);

  const setSearchTerm = useCallback((val) => {
    liveChatMemoryCache.searchTerm = val;
    setSearchTermState(val);
  }, []);

  const setChatFilter = useCallback((val) => {
    liveChatMemoryCache.chatFilter = val;
    setChatFilterState(val);
  }, []);

  const setIsBackendReady = useCallback((val) => {
    liveChatMemoryCache.isBackendReady = val;
    setIsBackendReadyState(val);
  }, []);

  // Referência mutável para activeJid acessível dentro do listener do Socket sem recriá-lo
  const activeJidRef = useRef(activeJid);
  useEffect(() => {
    activeJidRef.current = activeJid;
  }, [activeJid]);

  /**
   * Busca a lista atualizada de conversas do WhatsApp
   */
  const fetchChats = useCallback(async (silent = false) => {
    const shouldShowSpinner = !silent && liveChatMemoryCache.chats.length === 0;
    if (shouldShowSpinner) setIsLoadingChats(true);
    try {
      const response = await fetch(`${API_BASE}/api/live-chat/chats`);
      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok || (data && data.error)) {
        const errorMsg = data?.error || 'Falha ao comunicar com o servidor';
        throw new Error(errorMsg);
      }

      if (data && Array.isArray(data.chats)) {
        setChats(data.chats);
        setIsBackendReady(data.ready !== false);
      }
    } catch (err) {
      console.warn('[useLiveChat] Erro ao carregar conversas:', err.message);
      setIsBackendReady(false);
      if (!silent && notify && liveChatMemoryCache.chats.length === 0) {
        notify('Não foi possível carregar a lista de conversas.', 'warning');
      }
    } finally {
      if (shouldShowSpinner) setIsLoadingChats(false);
    }
  }, [notify, setChats, setIsBackendReady]);

  /**
   * Busca o histórico de mensagens do chat selecionado
   */
  const fetchMessagesForJid = useCallback(async (jid) => {
    if (!jid) return;
    const hasCached = liveChatMemoryCache.messagesCacheByJid.has(jid);
    if (!hasCached) {
      setIsLoadingMessages(true);
    }
    try {
      const response = await fetch(`${API_BASE}/api/live-chat/messages/${encodeURIComponent(jid)}?limit=60`);
      if (!response.ok) throw new Error('Falha ao buscar histórico de mensagens');
      const data = await response.json();

      if (data && data.success && Array.isArray(data.messages)) {
        const cleanMessages = data.messages.filter(isRenderableMessage);
        setMessages(cleanMessages);
        liveChatMemoryCache.messagesCacheByJid.set(jid, cleanMessages);

        // Zera o contador de não lidas localmente para este chat
        setChats(prev => prev.map(c => c.jid === jid ? { ...c, unreadCount: 0 } : c));
      }
    } catch (err) {
      console.warn(`[useLiveChat] Erro ao buscar mensagens de ${jid}:`, err.message);
      if (notify && !hasCached) notify('Erro ao carregar mensagens deste contato.', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [notify, setMessages, setChats]);

  /**
   * Seleciona uma conversa ativa
   */
  const selectChat = useCallback((jid) => {
    if (jid === activeJidRef.current) return;
    setActiveJid(jid);

    // Se já existirem mensagens no cache de RAM para este contato, exibe instantaneamente (0ms)
    if (liveChatMemoryCache.messagesCacheByJid.has(jid)) {
      setMessages(liveChatMemoryCache.messagesCacheByJid.get(jid));
    }
    fetchMessagesForJid(jid);
  }, [fetchMessagesForJid, setActiveJid, setMessages]);

  /**
   * Envia uma mensagem para o contato ativo com atualização otimista
   */
  const sendMessage = useCallback(async (text) => {
    const targetJid = activeJidRef.current;
    if (!targetJid) {
      if (notify) notify('Selecione uma conversa para enviar mensagem.', 'warning');
      return false;
    }

    const cleanText = (text || '').trim();
    if (!cleanText) return false;

    setIsSending(true);

    // Mensagem otimista na tela imediatamente
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      from: 'me',
      to: targetJid,
      fromMe: true,
      body: cleanText,
      type: 'chat',
      timestamp: Date.now(),
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMsg]);

    // Atualiza preview na lista lateral de chats
    setChats(prev => {
      const updated = prev.map(c => {
        if (c.jid === targetJid) {
          return {
            ...c,
            lastMessage: cleanText,
            timestamp: Date.now(),
            lastMsgFromMe: true
          };
        }
        return c;
      });
      // Move a conversa para o topo da lista
      const targetIndex = updated.findIndex(c => c.jid === targetJid);
      if (targetIndex > 0) {
        const [targetChat] = updated.splice(targetIndex, 1);
        updated.unshift(targetChat);
      }
      return updated;
    });

    try {
      const response = await fetch(`${API_BASE}/api/live-chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: targetJid, message: cleanText })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Falha ao enviar mensagem');
      }

      // Atualiza o ID temporário pelo ID oficial do WhatsApp ou remove duplicata se o Socket chegou antes
      setMessages(prev => {
        const alreadyInState = prev.some(m => m.id === result.messageId);
        if (alreadyInState) {
          return prev.filter(m => m.id !== tempId);
        }
        return prev.map(m => m.id === tempId ? { ...m, id: result.messageId, status: 'sent' } : m);
      });
      return true;
    } catch (err) {
      console.error('[useLiveChat] Erro ao enviar mensagem:', err.message);
      if (notify) notify(`Erro ao enviar: ${err.message}`, 'error');
      // Marca mensagem com erro
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
      return false;
    } finally {
      setIsSending(false);
    }
  }, [notify]);

  // Apaga uma mensagem (para todos ou para mim) no WhatsApp
  const deleteMessage = useCallback(async (targetJid, messageId, everyone = true) => {
    if (!messageId) return false;

    // Atualização otimista: remove a mensagem imediatamente da tela
    setMessages(prev => prev.filter(m => m.id !== messageId));

    try {
      const response = await fetch(`${API_BASE}/api/live-chat/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: targetJid, everyone })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Falha ao apagar mensagem no WhatsApp.');
      }

      if (notify) notify('Mensagem apagada com sucesso!', 'success');
      return true;
    } catch (err) {
      console.error('[useLiveChat] Erro ao deletar mensagem:', err.message);
      if (notify) notify(`Erro ao apagar: ${err.message}`, 'error');
      // Em caso de falha, recarrega o histórico para restaurar estado fidedigno
      if (targetJid) fetchMessagesForJid(targetJid);
      return false;
    }
  }, [fetchMessagesForJid, notify]);

  // Edita uma mensagem existente nativamente no WhatsApp
  const editMessage = useCallback(async (targetJid, messageId, newText) => {
    if (!messageId || !newText || !newText.trim()) return false;
    const cleanText = newText.trim();

    try {
      const response = await fetch(`${API_BASE}/api/live-chat/messages/${encodeURIComponent(messageId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: targetJid, message: cleanText })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Falha ao editar mensagem no WhatsApp.');
      }

      // Atualiza o estado da mensagem no painel
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, body: cleanText, isEdited: true } : m
      ));

      if (notify) notify('Mensagem editada com sucesso no WhatsApp!', 'success');
      return true;
    } catch (err) {
      console.error('[useLiveChat] Erro ao editar mensagem:', err.message);
      if (notify) notify(err.message, 'error');
      return false;
    }
  }, [notify]);

  // Carrega a lista inicial de conversas: se já há dados em RAM, busca em segundo plano silenciosamente
  useEffect(() => {
    fetchChats(liveChatMemoryCache.chats.length > 0);
  }, [fetchChats]);

  // Listener Socket.IO para novas mensagens, exclusões e edições em tempo real
  useEffect(() => {
    const handleNewMessage = (data) => {
      if (!data || !data.jid || !data.message) return;
      const { jid, message } = data;

      // Descarta mensagens de sistema ou sem conteúdo renderizável
      if (!isRenderableMessage(message)) return;

      // Se a mensagem pertence à conversa atualmente aberta
      if (activeJidRef.current === jid) {
        setMessages(prev => {
          // Evita duplicatas se o ID já existir
          if (prev.some(m => m.id === message.id)) return prev;

          // Se for mensagem própria enviada por este cliente, reconcilia com a mensagem temporária otimista pendente
          if (message.fromMe) {
            const pendingIndex = prev.findIndex(m =>
              m.fromMe &&
              (m.status === 'sending' || String(m.id).startsWith('temp_')) &&
              m.body === message.body
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = { ...message, status: 'sent' };
              return updated;
            }
          }

          return [...prev, message];
        });
      }

      // Atualiza o preview na lista de conversas
      setChats(prev => {
        const isGroupMsg = Boolean(message.isGroup || (jid && jid.endsWith('@g.us')));
        const chatExists = prev.some(c => c.jid === jid);
        if (!chatExists) {
          // Se for um contato ou grupo novo, recarrega a lista silenciosamente
          fetchChats(true);
          return prev;
        }

        const updated = prev.map(c => {
          if (c.jid === jid) {
            return {
              ...c,
              isGroup: Boolean(c.isGroup || isGroupMsg),
              lastMessage: message.body || c.lastMessage,
              timestamp: message.timestamp || Date.now(),
              lastMsgFromMe: Boolean(message.fromMe),
              unreadCount: activeJidRef.current === jid ? 0 : (c.unreadCount || 0) + 1
            };
          }
          return c;
        });

        // Reordena: o chat que recebeu mensagem sobe para o topo
        const index = updated.findIndex(c => c.jid === jid);
        if (index > 0) {
          const [moved] = updated.splice(index, 1);
          updated.unshift(moved);
        }
        return updated;
      });
    };

    const handleMessageDeleted = (data) => {
      if (!data || !data.messageId) return;
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    const handleMessageEdited = (data) => {
      if (!data || !data.messageId || typeof data.newBody !== 'string') return;
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, body: data.newBody, isEdited: true } : m
      ));
    };

    const handleStatusChange = (status) => {
      if (status === 'ready') {
        setIsBackendReady(true);
        fetchChats(true);
      } else if (status === 'disconnected' || status === 'auth_failure' || status === 'no_internet') {
        setIsBackendReady(false);
      }
    };

    socket.on('live-chat:new-message', handleNewMessage);
    socket.on('live-chat:message-deleted', handleMessageDeleted);
    socket.on('live-chat:message-edited', handleMessageEdited);
    socket.on('status', handleStatusChange);

    return () => {
      socket.off('live-chat:new-message', handleNewMessage);
      socket.off('live-chat:message-deleted', handleMessageDeleted);
      socket.off('live-chat:message-edited', handleMessageEdited);
      socket.off('status', handleStatusChange);
    };
  }, [fetchChats, setIsBackendReady]);

  // Contadores para as abas de categoria (Todas / Privadas / Grupos)
  const counts = useMemo(() => {
    let direct = 0;
    let groups = 0;
    for (const c of chats) {
      const isGrp = Boolean(c.isGroup || (c.jid && c.jid.endsWith('@g.us')));
      if (isGrp) groups++;
      else direct++;
    }
    return { all: chats.length, direct, groups };
  }, [chats]);

  // Conversas filtradas por categoria (Todas / Privadas / Grupos) e pelo campo de busca
  const filteredChats = useMemo(() => {
    let result = chats;

    if (chatFilter === 'direct') {
      result = result.filter(c => !c.isGroup && !(c.jid && c.jid.endsWith('@g.us')));
    } else if (chatFilter === 'groups') {
      result = result.filter(c => Boolean(c.isGroup || (c.jid && c.jid.endsWith('@g.us'))));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.number && c.number.includes(term)) ||
        (c.phoneFormatted && c.phoneFormatted.toLowerCase().includes(term)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(term))
      );
    }

    return result;
  }, [chats, chatFilter, searchTerm]);

  // Contato atualmente selecionado
  const activeChat = useMemo(() => {
    return chats.find(c => c.jid === activeJid) || null;
  }, [chats, activeJid]);

  // Garante rigorosa desduplicação de mensagens por ID para a interface
  const deduplicatedMessages = useMemo(() => {
    const seen = new Set();
    return messages.filter(m => {
      const key = m.id || `${m.fromMe}_${m.body}_${m.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages]);

  return {
    chats: filteredChats,
    totalChatsCount: chats.length,
    activeJid,
    activeChat,
    messages: deduplicatedMessages,
    isLoadingChats,
    isLoadingMessages,
    isSending,
    searchTerm,
    setSearchTerm,
    chatFilter,
    setChatFilter,
    counts,
    selectChat,
    sendMessage,
    deleteMessage,
    editMessage,
    refreshChats: fetchChats,
    isBackendReady,
  };
}
