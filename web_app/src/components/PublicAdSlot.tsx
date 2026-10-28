import React from 'react';

interface PublicAdSlotProps {
  label?: string;
  format?: 'banner' | 'card' | 'inline';
}

/**
 * PublicAdSlot — Reusable Privacy-Preserving Monetization Component
 * 
 * CRITICAL RULE: This component MUST ONLY be rendered on public product pages 
 * (/, /features, /security, /help, /download).
 * 
 * NEVER render this component inside private authenticated conversation screens (/app/*).
 * Zero user message data, encryption keys, or private identity payload is ever shared.
 */
export const PublicAdSlot: React.FC<PublicAdSlotProps> = ({ label = 'Sponsored Content', format = 'banner' }) => {
  return (
    <div 
      className="chartpie-public-ad-slot"
      style={{
        margin: format === 'banner' ? '36px 0' : '20px 0',
        padding: '16px 20px',
        backgroundColor: '#FFF9EF',
        border: '1px dashed #E7A23B',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: format === 'banner' ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 2px 10px rgba(231, 162, 59, 0.08)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'rgba(231, 162, 59, 0.18)',
            color: '#E7A23B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          ✦
        </div>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, color: '#C98262', marginBottom: '2px' }}>
            {label}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#3B3530' }}>
            Chartpie Enterprise & Hosted Relays for Organizations
          </div>
          <div style={{ fontSize: '12px', color: '#81766C' }}>
            Deploy custom zero-knowledge messaging infrastructure for your team with dedicated STUN/TURN nodes.
          </div>
        </div>
      </div>
      <a
        href="mailto:enterprise@chartpie.org?subject=Chartpie%20Enterprise%20Inquiry"
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: '#E7A23B',
          color: '#FFFDF8',
          fontWeight: 700,
          fontSize: '12px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(231, 162, 59, 0.3)',
        }}
      >
        Learn More →
      </a>
    </div>
  );
};
