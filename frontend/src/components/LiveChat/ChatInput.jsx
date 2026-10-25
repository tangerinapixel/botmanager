// frontend/src/components/LiveChat/ChatInput.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bold, Italic, Strikethrough, Code, Smile, Pencil, X } from 'lucide-react';
import EmojiPickerPopover from './EmojiPickerPopover';

export default function ChatInput({
  onSendMessage,
  onSaveEdit,
  editingMessage,
  onCancelEdit,
  disabled,
  isSending,
  activeChat,
}) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  // Foca no input sempre que o chat ativo mudar
  useEffect(() => {
    if (activeChat && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeChat]);

  // Carrega o texto da mensagem a ser editada e posiciona o cursor ao final
  useEffect(() => {
    if (editingMessage && typeof editingMessage.body === 'string') {
      setText(editingMessage.body);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = editingMessage.body.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
    }
  }, [editingMessage]);

  // Expande e contrai dinamicamente a caixa de texto conforme o conteúdo
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 40), 140);
      textarea.style.height = `${newHeight}px`;
    }
  }, [text]);

  const handleSend = async () => {
    if (!text.trim() || disabled || isSending) return;
    const toSend = text;
    setText('');
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    if (editingMessage && typeof onSaveEdit === 'function') {
      const success = await onSaveEdit(toSend);
      if (!success) {
        setText(toSend);
      }
    } else {
      const success = await onSendMessage(toSend);
      if (!success) {
        setText(toSend);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Aplica marcações de formatação nativa do WhatsApp (*negrito*, _itálico_, ~tachado~, ```código```)
  const applyFormat = (prefix, suffix = prefix) => {
    if (!textareaRef.current || disabled || isSending) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const selected = text.substring(start, end);

    let newText = '';
    let newCursorPos = start + prefix.length;

    if (selected) {
      newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
      newCursorPos = start + prefix.length + selected.length + suffix.length;
    } else {
      newText = text.substring(0, start) + prefix + suffix + text.substring(end);
      newCursorPos = start + prefix.length;
    }

    setText(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Insere o emoji selecionado na posição do cursor sem perder o foco
  const handleInsertEmoji = (emoji) => {
    if (!textareaRef.current || disabled || isSending) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;

    const newText = text.substring(0, start) + emoji + text.substring(end);
    const newCursorPos = start + emoji.length;

    setText(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  return (
    <div className="live-chat-input-container">
      {/* Popover Flutuante de Emojis */}
      <EmojiPickerPopover
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleInsertEmoji}
      />

      {/* Banner de Edição Ativa */}
      {editingMessage && (
        <div className="live-chat-editing-banner">
          <div className="live-chat-editing-banner-left">
            <Pencil size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <div className="live-chat-editing-banner-text">
              <span className="live-chat-editing-title">
                {editingMessage.isOver15Min ? 'Reenviando mensagem corrigida:' : 'Editando mensagem no WhatsApp:'}
              </span>
              <span className="live-chat-editing-preview">
                {editingMessage.body}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="live-chat-editing-cancel-btn"
            onClick={() => {
              if (typeof onCancelEdit === 'function') onCancelEdit();
              setText('');
            }}
            title="Cancelar edição"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Barra Discreta de Formatação Rápida & Emojis */}
      <div className="live-chat-format-toolbar">
        <button
          type="button"
          className={`live-chat-tool-btn ${showEmojiPicker ? 'active' : ''}`}
          onClick={() => setShowEmojiPicker(prev => !prev)}
          disabled={disabled || isSending}
          title="Inserir Emoji"
        >
          <Smile size={14} />
        </button>

        <div className="live-chat-toolbar-divider" />

        <button
          type="button"
          className="live-chat-tool-btn"
          onClick={() => applyFormat('*')}
          disabled={disabled || isSending}
          title="Negrito (*texto*)"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          className="live-chat-tool-btn"
          onClick={() => applyFormat('_')}
          disabled={disabled || isSending}
          title="Itálico (_texto_)"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          className="live-chat-tool-btn"
          onClick={() => applyFormat('~')}
          disabled={disabled || isSending}
          title="Tachado (~texto~)"
        >
          <Strikethrough size={13} />
        </button>
        <button
          type="button"
          className="live-chat-tool-btn"
          onClick={() => applyFormat('```')}
          disabled={disabled || isSending}
          title="Monoespaçado (```texto```)"
        >
          <Code size={13} />
        </button>
      </div>

      {/* Caixa de Texto e Botão de Envio */}
      <div className="live-chat-input-bar">
        <textarea
          ref={textareaRef}
          className="live-chat-textarea"
          placeholder={
            disabled
              ? 'Selecione uma conversa para responder...'
              : editingMessage
                ? (editingMessage.isOver15Min ? 'Corrija o texto e pressione Enter para reenviar...' : 'Edite o texto e pressione Enter para salvar no WhatsApp...')
                : 'Digite uma mensagem (Pressione Enter para enviar)...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          rows={1}
        />

        <button
          type="button"
          className="live-chat-send-btn"
          onClick={handleSend}
          disabled={disabled || !text.trim() || isSending}
          title={
            editingMessage
              ? (editingMessage.isOver15Min ? 'Reenviar corrigida (Enter)' : 'Salvar edição (Enter)')
              : 'Enviar mensagem (Enter)'
          }
        >
          {isSending ? (
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={18} style={{ marginLeft: '2px' }} />
          )}
        </button>
      </div>
    </div>
  );
}
