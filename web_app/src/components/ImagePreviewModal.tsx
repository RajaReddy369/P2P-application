import React from 'react';

interface ImagePreviewModalProps {
  imageFile: File;
  dataUrl: string;
  onConfirmSend: () => void;
  onCancel: () => void;
  isSending?: boolean;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageFile,
  dataUrl,
  onConfirmSend,
  onCancel,
  isSending = false,
}) => {
  const formattedSize = (imageFile.size / (1024 * 1024)).toFixed(2);

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
          maxWidth: '460px',
          backgroundColor: '#FFFDF8',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>
            Send Encrypted Image
          </h3>
          <button
            onClick={onCancel}
            disabled={isSending}
            style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 800, color: '#81766C', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Image Preview Box */}
        <div
          style={{
            maxHeight: '260px',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: '#FFF9EF',
            border: '1px solid #E9DED1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            padding: '8px',
          }}
        >
          <img
            src={dataUrl}
            alt="Upload Preview"
            style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '10px' }}
          />
        </div>

        {/* Metadata */}
        <div style={{ fontSize: '12px', color: '#81766C', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontWeight: 700, color: '#3B3530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
            📄 {imageFile.name}
          </span>
          <span>
            {formattedSize} MB ({imageFile.type.split('/')[1]?.toUpperCase()})
          </span>
        </div>

        {/* Security badge */}
        <div style={{ backgroundColor: 'rgba(120, 168, 120, 0.15)', border: '1px solid rgba(120, 168, 120, 0.4)', borderRadius: '10px', padding: '10px 14px', fontSize: '11px', color: '#2E632E', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔒</span>
          <span>Image bytes will be encrypted client-side with AES-GCM before payload synchronization.</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            style={{
              padding: '10px 20px',
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
            type="button"
            onClick={onConfirmSend}
            disabled={isSending}
            className="auren-btn-primary"
            style={{ padding: '10px 22px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isSending ? 'Encrypting & Sending...' : '🔒 Send Encrypted Image'}
          </button>
        </div>
      </div>
    </div>
  );
};
