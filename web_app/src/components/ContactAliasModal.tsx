import React, { useState } from 'react';

interface ContactAliasModalProps {
  peerUsername: string;
  originalDisplayName: string;
  currentAlias: string;
  onSaveAlias: (newAlias: string) => void;
  onClearAlias: () => void;
  onClose: () => void;
}

export const ContactAliasModal: React.FC<ContactAliasModalProps> = ({
  peerUsername,
  originalDisplayName,
  currentAlias,
  onSaveAlias,
  onClearAlias,
  onClose,
}) => {
  const [aliasInput, setAliasInput] = useState(currentAlias || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAlias(aliasInput.trim());
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(59, 53, 48, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="warm-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#FFFDF8',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>
            Edit Contact Name Alias
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 800, color: '#81766C', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', marginBottom: '20px' }}>
          Assign a personal contact name for <strong>@{peerUsername}</strong>. This custom alias is stored locally for your account and will not change their global profile.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>
              Account Original Name
            </label>
            <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#FFF9EF', border: '1px solid #E9DED1', fontSize: '13px', color: '#3B3530', fontWeight: 700 }}>
              {originalDisplayName} (@{peerUsername})
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#81766C', marginBottom: '6px', fontWeight: 600 }}>
              Personal Contact Alias
            </label>
            <input
              className="auren-input"
              type="text"
              autoFocus
              placeholder="e.g. Rahul - College"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '12px' }}>
            {currentAlias ? (
              <button
                type="button"
                onClick={onClearAlias}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#C93B3B',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Reset to Original
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-warm)',
                  backgroundColor: '#FFFDF8',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#3B3530',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="auren-btn-primary"
                style={{ padding: '10px 22px', fontSize: '13px' }}
              >
                Save Alias
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
