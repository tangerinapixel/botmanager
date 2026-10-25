import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { MessageCircle, CheckCheck, Clock, AlertTriangle, Phone, Users, Pencil, Trash2 } from 'lucide-react';
import ContactAvatar from './ContactAvatar';
import { isRenderableMessage } from '../../hooks/useLiveChat';

function getMediaFallbackLabel(type) {
  switch (type) {
    case 'audio':
    case 'ptt':
      return '🎵 Áudio';
    case 'image':
      return '📷 Imagem';
    case 'video':
      return '🎥 Vídeo';
    case 'document':
      return '📄 Documento';
    case 'sticker':
      return '🏷️ Figurinha';
    case 'location':
      return '📍 Localização';
    case 'vcard':
    case 'multi_vcard':
      return '👤 Contato';
    default:
      return '📎 Arquivo de Mídia';
  }
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatFullDateTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function getDayKey(timestamp) {
  if (!timestamp) return 'unknown';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'Hoje';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Renderiza formatação do WhatsApp de forma segura e reativa:
 * - *negrito* -> <strong>
 * - _itálico_ -> <em>
 * - ~tachado~ -> <del>
 * - ```código``` -> <code>
 * - Links http/https -> <a target="_blank">
 */
function formatWhatsAppText(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const regex = /(```[\s\S]*?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g;
    const parts = line.split(regex);

    const formattedParts = parts.map((part, pIdx) => {
      if (!part) return null;

      if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
        return (
          <code key={pIdx} className="live-chat-code-block">
            {part.slice(3, -3)}
          </code>
        );
      }

      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return <strong key={pIdx}>{part.slice(1, -1)}</strong>;
      }

      if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
        return <em key={pIdx}>{part.slice(1, -1)}</em>;
      }

      if (part.startsWith('~') && part.endsWith('~') && part.length >= 2) {
        return <del key={pIdx}>{part.slice(1, -1)}</del>;
      }

      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={pIdx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="live-chat-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {formattedParts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export default function ChatMessageArea({
  activeChat,
  messages,
  isLoadingMessages,
  onStartEdit,
  onDeleteMessage,
}) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentJid = activeChat?.jid || null;
  const lastJidRef = useRef(currentJid);
  const shouldInstantScrollRef = useRef(true);
  const lastMessagesLengthRef = useRef(0);
  const lastMessageIdRef = useRef(null);

  // Detecta mudança de conversa ativa (JID) durante o ciclo de renderização
  if (currentJid !== lastJidRef.current) {
    lastJidRef.current = currentJid;
    shouldInstantScrollRef.current = true;
    lastMessagesLengthRef.current = 0;
    lastMessageIdRef.current = null;
  }

  // Ancoragem instantânea (pre-paint) e rolagem inteligente
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const messageCount = Array.isArray(messages) ? messages.length : 0;
    const lastMsg = messageCount > 0 ? messages[messageCount - 1] : null;
    const currentLastId = lastMsg?.id || null;

    // Caso 1: Abertura / Seleção de Conversa ou Carregamento Inicial do Histórico
    // Mantém shouldInstantScrollRef ativo até que as mensagens cheguem e sejam renderizadas no DOM
    if (shouldInstantScrollRef.current) {
      if (!isLoadingMessages && messageCount > 0) {
        // Posicionamento 100% instantâneo no rodapé antes do navegador pintar a tela (0ms, sem animação de rolagem)
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
        shouldInstantScrollRef.current = false;
        lastMessagesLengthRef.current = messageCount;
        lastMessageIdRef.current = currentLastId;
      }
      return;
    }

    // Caso 2: Conversa já aberta e houve acréscimo de nova mensagem (incremental)
    const isNewMessageAdded = (messageCount > lastMessagesLengthRef.current) ||
                              (currentLastId && currentLastId !== lastMessageIdRef.current);

    if (isNewMessageAdded) {
      // Verifica se o operador enviou a mensagem (fromMe) OU se já estava próximo ao rodapé (< 180px)
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom < 180;
      const isSentByMe = Boolean(lastMsg?.fromMe);

      if (isSentByMe || isNearBottom) {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
      // Se o operador estiver lendo mensagens antigas no topo, não puxa o scroll à força
    }

    lastMessagesLengthRef.current = messageCount;
    lastMessageIdRef.current = currentLastId;
  }, [messages, isLoadingMessages, currentJid]);

  // Se nenhum chat estiver selecionado
  if (!activeChat) {
    return (
      <div className="live-chat-empty-state">
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          backgroundColor: 'rgba(79, 142, 247, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-primary)',
        }}>
          <MessageCircle size={28} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          Central de Conversas
        </h3>
        <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '320px', lineHeight: 1.5 }}>
          Selecione uma conversa ou grupo na lista ao lado para ler o histórico e responder mensagens em tempo real.
        </p>
      </div>
    );
  }

  const isGroup = Boolean(activeChat.isGroup || (activeChat.jid && activeChat.jid.endsWith('@g.us')));
  const rawName = activeChat.name || '';
  const isUnknown = !rawName || rawName.toLowerCase() === 'desconhecido' || rawName.toLowerCase() === 'desconhecida' || rawName.toLowerCase() === 'unknown';
  const displayName = isUnknown
    ? (activeChat.phoneFormatted || (activeChat.number ? `+${activeChat.number}` : (isGroup ? (activeChat.isCommunity ? 'Comunidade' : 'Grupo') : 'Contato')))
    : rawName;
  let lastDayKey = null;

  return (
    <>
      {/* Cabeçalho do Chat Ativo */}
      <div className="live-chat-header">
        <div className="live-chat-header-user">
          <ContactAvatar
            jid={activeChat.jid}
            name={displayName}
            isGroup={isGroup}
            size={38}
            initialAvatarUrl={activeChat.avatarUrl}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {displayName}
              </span>
              {isGroup && (
                <span className="live-chat-badge-group">
                  {activeChat.isCommunity ? 'Comunidade' : 'Grupo'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isGroup ? <Users size={11} /> : <Phone size={10} />}
              <span>{activeChat.phoneFormatted || activeChat.number || (isGroup ? 'Grupo do WhatsApp' : '')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Área de Mensagens com Divisores de Data e Auto-scroll */}
      <div className="live-chat-messages-container" ref={containerRef}>
        {isLoadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Carregando histórico de mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
            Nenhuma mensagem anterior encontrada para este contato.<br />Envie a primeira mensagem abaixo!
          </div>
        ) : (
          messages.map((msg, index) => {
            if (!isRenderableMessage(msg)) return null;

            const isMe = Boolean(msg.fromMe);
            const currentDayKey = getDayKey(msg.timestamp);
            const showDateDivider = currentDayKey !== lastDayKey;
            lastDayKey = currentDayKey;

            const isMedia = Boolean(msg.hasMedia || ['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'vcard', 'multi_vcard'].includes(msg.type));
            const hasBody = Boolean(typeof msg.body === 'string' && msg.body.trim().length > 0);

            return (
              <React.Fragment key={msg.id || index}>
                {/* Divisor Visual de Data */}
                {showDateDivider && (
                  <div className="live-chat-date-divider">
                    <span className="live-chat-date-pill">
                      {formatDayLabel(msg.timestamp)}
                    </span>
                  </div>
                )}

                {/* Bolha da Mensagem */}
                <div
                  className={`live-chat-bubble ${isMe ? 'sent' : 'received'}`}
                  title={formatFullDateTime(msg.timestamp)}
                >
                  {/* Se for mensagem recebida em grupo, identifica o remetente */}
                  {isGroup && !isMe && (
                    <div className="live-chat-bubble-author">
                      {(!msg.authorName || msg.authorName.toLowerCase() === 'desconhecido' || msg.authorName.toLowerCase() === 'unknown') ? (msg.author || 'Participante') : msg.authorName}
                    </div>
                  )}

                  <div className="live-chat-bubble-text">
                    {/* Fallback elegante para mídias sem legenda */}
                    {isMedia && !hasBody && (
                      <span className="live-chat-media-fallback" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontStyle: 'italic', opacity: 0.9 }}>
                        {getMediaFallbackLabel(msg.type)}
                      </span>
                    )}

                    {/* Mídia com legenda: exibe indicador de mídia + texto */}
                    {isMedia && hasBody && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontStyle: 'italic', opacity: 0.85, marginBottom: '4px', fontSize: '0.78rem' }}>
                        {getMediaFallbackLabel(msg.type)}
                      </div>
                    )}

                    {hasBody && formatWhatsAppText(msg.body)}
                  </div>

                  <div className="live-chat-bubble-meta">
                    {/* Botões de Ação para Mensagens Enviadas (à esquerda da hora) */}
                    {isMe && msg.status !== 'sending' && msg.status !== 'error' && (
                      <div className="live-chat-bubble-actions">
                        <button
                          type="button"
                          className="live-chat-bubble-action-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onStartEdit === 'function') onStartEdit(msg);
                          }}
                          title="Editar mensagem"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          className="live-chat-bubble-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Deseja apagar esta mensagem para todos?')) {
                              if (typeof onDeleteMessage === 'function') onDeleteMessage(msg);
                            }
                          }}
                          title="Apagar mensagem para todos"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Tag 'Editada' exibida quando a mensagem foi alterada */}
                    {msg.isEdited && (
                      <span className="live-chat-edited-tag">Editada</span>
                    )}

                    <span title={formatFullDateTime(msg.timestamp)}>
                      {formatMessageTime(msg.timestamp)}
                    </span>
                    {isMe && (
                      <span>
                        {msg.status === 'sending' && <Clock size={11} style={{ opacity: 0.7 }} />}
                        {msg.status === 'error' && <AlertTriangle size={11} style={{ color: 'var(--accent-danger)' }} />}
                        {msg.status !== 'sending' && msg.status !== 'error' && <CheckCheck size={12} style={{ color: '#25d366' }} />}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
}
