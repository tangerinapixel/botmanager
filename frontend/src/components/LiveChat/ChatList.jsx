// frontend/src/components/LiveChat/ChatList.jsx
import React from 'react';
import { Search, RefreshCw, MessageSquare, AlertCircle, Users, Pin } from 'lucide-react';
import ContactAvatar from './ContactAvatar';

/**
 * Formata o carimbo temporal de forma completa para dar controle total ao operador
 * - Hoje: 15:35
 * - Ontem: Ontem às 15:35
 * - Este ano: 23/10 às 15:35
 * - Anos anteriores: 23/10/2025 às 15:35
 */
function formatChatTime(timestamp) {
  if (!timestamp || timestamp <= 0) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Ontem às ${timeStr}`;
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (isThisYear) {
    return `${dayMonth} às ${timeStr}`;
  }

  return `${dayMonth}/${date.getFullYear()} às ${timeStr}`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getDisplayName(chat) {
  if (!chat) return '';
  const name = chat.name || '';
  const lower = name.trim().toLowerCase();
  const isGroup = Boolean(chat.isGroup || (chat.jid && chat.jid.endsWith('@g.us')));
  if (!name || lower === 'desconhecido' || lower === 'desconhecida' || lower === 'unknown') {
    return chat.phoneFormatted || (chat.number ? `+${chat.number}` : (isGroup ? (chat.isCommunity ? 'Comunidade' : 'Grupo') : 'Contato'));
  }
  return name;
}

export default function ChatList({
  chats,
  activeJid,
  onSelectChat,
  searchTerm,
  onSearchChange,
  chatFilter = 'all',
  onFilterChange,
  counts = { all: 0, direct: 0, groups: 0 },
  onRefresh,
  isLoading,
  isBackendReady,
}) {
  return (
    <div className="live-chat-sidebar">
      {/* Header com Busca e Ações */}
      <div className="live-chat-search-header">
        <div className="live-chat-search-header-title">
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Conversas ({counts.all || chats.length})
          </span>
          <button
            onClick={() => onRefresh(false)}
            disabled={isLoading}
            title="Atualizar lista de conversas"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Abas de Categoria: Todas / Privadas / Grupos */}
        <div className="live-chat-filter-tabs">
          <button
            type="button"
            className={`live-chat-tab-btn ${chatFilter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange && onFilterChange('all')}
          >
            Todas <span className="live-chat-tab-count">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`live-chat-tab-btn ${chatFilter === 'direct' ? 'active' : ''}`}
            onClick={() => onFilterChange && onFilterChange('direct')}
          >
            Privadas <span className="live-chat-tab-count">{counts.direct}</span>
          </button>
          <button
            type="button"
            className={`live-chat-tab-btn ${chatFilter === 'groups' ? 'active' : ''}`}
            onClick={() => onFilterChange && onFilterChange('groups')}
          >
            Grupos <span className="live-chat-tab-count">{counts.groups}</span>
          </button>
        </div>

        <div className="live-chat-search-input-wrapper">
          <Search size={14} />
          <input
            type="text"
            className="live-chat-search-input"
            placeholder="Pesquisar conversa, grupo ou telefone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Aviso se o WhatsApp ainda não estiver pronto */}
      {!isBackendReady && (
        <div style={{
          padding: '8px 12px',
          margin: '8px',
          borderRadius: '6px',
          background: 'rgba(240, 165, 0, 0.1)',
          border: '1px solid rgba(240, 165, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.72rem',
          color: 'var(--accent-warning)',
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>WhatsApp conectando... chats serão exibidos em instantes.</span>
        </div>
      )}

      {/* Lista com Scroll */}
      <div className="live-chat-list-scroll">
        {chats.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px 16px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            gap: '8px',
          }}>
            <MessageSquare size={22} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '0.78rem' }}>
              {searchTerm
                ? 'Nenhuma conversa encontrada na busca.'
                : chatFilter === 'groups'
                  ? 'Nenhum grupo ou comunidade encontrado.'
                  : 'Nenhuma conversa recente registrada.'}
            </span>
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.jid === activeJid;
            const isGroup = Boolean(chat.isGroup || (chat.jid && chat.jid.endsWith('@g.us')));
            const displayName = getDisplayName(chat);

            return (
              <div
                key={chat.jid}
                className={`live-chat-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.jid)}
              >
                {/* Avatar com Foto de Perfil ou Iniciais/Ícone */}
                <ContactAvatar
                  jid={chat.jid}
                  name={displayName}
                  isGroup={isGroup}
                  size={42}
                  initialAvatarUrl={chat.avatarUrl}
                />

                {/* Dados da Conversa */}
                <div className="live-chat-item-info">
                  <div className="live-chat-item-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span className="live-chat-item-name" title={displayName}>
                        {displayName}
                      </span>
                      {isGroup && (
                        <span className="live-chat-badge-group">
                          {chat.isCommunity ? 'Comunidade' : 'Grupo'}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {chat.isPinned && <Pin size={11} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />}
                      <span className="live-chat-item-time" title={chat.timestamp ? new Date(chat.timestamp).toLocaleString('pt-BR') : ''}>
                        {formatChatTime(chat.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="live-chat-item-bottom">
                    <span className="live-chat-item-preview">
                      {chat.lastMsgFromMe && <span style={{ color: 'var(--accent-primary)', marginRight: '3px' }}>Você:</span>}
                      {chat.lastMessage || (isGroup ? 'Grupo sem mensagens recentes' : 'Toque para conversar')}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="live-chat-item-badge">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
