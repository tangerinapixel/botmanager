// frontend/src/components/LiveChat/LiveChatHub.jsx
// Container modular principal da Central de Mensagens e Atendimento

import React, { useState } from 'react';
import './LiveChat.css';
import { useLiveChat } from '../../hooks/useLiveChat';
import ChatList from './ChatList';
import ChatMessageArea from './ChatMessageArea';
import ChatInput from './ChatInput';

export default function LiveChatHub() {
  const {
    chats,
    activeJid,
    activeChat,
    messages,
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
    refreshChats,
    isBackendReady,
  } = useLiveChat();

  const [editingMessage, setEditingMessage] = useState(null);

  // Inicia o processo de edição de uma mensagem enviada
  const handleStartEdit = (msg) => {
    if (!msg || !msg.body) return;
    const msgTime = msg.timestamp ? (msg.timestamp < 1e12 ? msg.timestamp * 1000 : msg.timestamp) : Date.now();
    const isOver15Min = (Date.now() - msgTime) > (15 * 60 * 1000);
    setEditingMessage({
      id: msg.id,
      body: msg.body,
      timestamp: msgTime,
      isOver15Min
    });
  };

  // Cancela a edição e fecha a barra de edição
  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  // Salva a edição: se tiver < 15 min edita nativamente; se > 15 min envia corrigida
  const handleSaveEdit = async (text) => {
    if (!editingMessage) return false;
    if (editingMessage.isOver15Min) {
      const sent = await sendMessage(text);
      if (sent) {
        setEditingMessage(null);
        return true;
      }
      return false;
    } else {
      const edited = await editMessage(activeJid, editingMessage.id, text);
      if (edited) {
        setEditingMessage(null);
        return true;
      }
      return false;
    }
  };

  // Solicita a exclusão de uma mensagem para todos
  const handleDeleteMessage = async (msg) => {
    if (!msg || !msg.id) return;
    await deleteMessage(activeJid, msg.id, true);
  };

  return (
    <div className="live-chat-container">
      {/* Coluna 1: Lista de Conversas */}
      <ChatList
        chats={chats}
        activeJid={activeJid}
        onSelectChat={(jid) => {
          setEditingMessage(null);
          selectChat(jid);
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        chatFilter={chatFilter}
        onFilterChange={setChatFilter}
        counts={counts}
        onRefresh={refreshChats}
        isLoading={isLoadingChats}
        isBackendReady={isBackendReady}
      />

      {/* Coluna 2: Janela de Atendimento Ativa */}
      <div className="live-chat-main">
        <ChatMessageArea
          activeChat={activeChat}
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onStartEdit={handleStartEdit}
          onDeleteMessage={handleDeleteMessage}
        />

        <ChatInput
          onSendMessage={sendMessage}
          onSaveEdit={handleSaveEdit}
          editingMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
          disabled={!activeChat}
          isSending={isSending}
          activeChat={activeChat}
        />
      </div>
    </div>
  );
}
