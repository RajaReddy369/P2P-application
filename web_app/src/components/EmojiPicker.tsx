import React, { useState } from 'react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😊', '😂', '🥰', '😍', '😎', '😇', '🤔', '😅', '🥳', '😌', '🙃', '😏', '🤩', '🥺', '😭', '🤯', '😴', '🙈', '🤗', '😋'],
  },
  {
    name: 'Gestures & People',
    emojis: ['👍', '👋', '🙌', '👏', '🤝', '🙏', '✌️', '💪', '👈', '👉', '🖐️', '👊', '🤞', '👌', '🙋‍♂️', '🙋‍♀️', '👀', '🔥', '✨', '🎉'],
  },
  {
    name: 'Hearts & Symbols',
    emojis: ['❤️', '💛', '💖', '💙', '💜', '🖤', '🤍', '🧡', '💯', '⭐', '🌟', '⚡', '🔒', '🔑', '🛡️', '✅', '💬', '🔔', '📌', '🚀'],
  },
  {
    name: 'Objects & Communication',
    emojis: ['📱', '💻', '📷', '📁', '✉️', '📞', '🌐', '📊', '📝', '⚡', '☕', '🍕', '🎉', '🎁', '💡', '🎨', '🎵', '🏆', '🎯', '🌈'],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div
      className="chartpie-emoji-picker warm-card animate-fade-in"
      style={{
        position: 'absolute',
        bottom: '60px',
        left: '16px',
        width: '310px',
        maxHeight: '320px',
        backgroundColor: '#FFFDF8',
        border: '1px solid var(--border-warm)',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(59, 53, 48, 0.15)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-warm)', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 800, fontSize: '13px', color: '#3B3530' }}>
          Select Emoji
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 800, color: '#81766C', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', borderBottom: '1px solid #E9DED1', paddingBottom: '6px' }}>
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveTab(idx)}
            style={{
              flex: 1,
              padding: '4px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: activeTab === idx ? '#FFF9EF' : 'transparent',
              cursor: 'pointer',
              borderBottom: activeTab === idx ? '2px solid #E7A23B' : '2px solid transparent',
            }}
            title={cat.name}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', padding: '4px' }}>
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            style={{
              fontSize: '22px',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFF9EF')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
