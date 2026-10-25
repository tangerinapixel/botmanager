// frontend/src/components/LiveChat/EmojiPickerPopover.jsx
// Menu flutuante compacto de emojis com suporte a abas de categorias e inserção rápida

import React, { useState, useEffect, useRef } from 'react';

const EMOJI_CATEGORIES = [
  {
    id: 'expressions',
    label: 'Expressões',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
      '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳', '🤔', '🤐', '🤫', '😴', '🤯'
    ]
  },
  {
    id: 'gestures',
    label: 'Gestos',
    emojis: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞', '👌', '👋', '💪', '❤️',
      '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '🔥', '✨', '⭐'
    ]
  },
  {
    id: 'business',
    label: 'Atendimento',
    emojis: [
      '✅', '❌', '⚠️', '❗', '❓', '💬', '📢', '📅', '⏰', '📍', '📞', '📧',
      '💼', '📊', '📈', '🚀', '💡', '🔒', '🔑', '💰', '💳', '🎁', '🎉', '🏆'
    ]
  }
];

export default function EmojiPickerPopover({
  open,
  onClose,
  onSelectEmoji,
}) {
  const [activeCategory, setActiveCategory] = useState('expressions');
  const popoverRef = useRef(null);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div ref={popoverRef} className="live-chat-emoji-popover">
      {/* Abas de Categorias */}
      <div className="live-chat-emoji-tabs">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`live-chat-emoji-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grade de Emojis */}
      <div className="live-chat-emoji-grid">
        {currentCategory.emojis.map((emoji, idx) => (
          <button
            key={idx}
            type="button"
            className="live-chat-emoji-item"
            onClick={(e) => {
              e.preventDefault();
              onSelectEmoji(emoji);
            }}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
