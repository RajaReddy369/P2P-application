import React, { useState } from 'react';
import { PublicAdSlot } from './PublicAdSlot';

interface PublicPagesProps {
  currentPath: string;
  navigate: (path: string) => void;
  deferredPrompt: any;
}

export const PublicPages: React.FC<PublicPagesProps> = ({ currentPath, navigate, deferredPrompt }) => {
  const [helpSearch, setHelpSearch] = useState('');

  // ----------------------------------------------------
  // 1. HOME / INTRODUCTION PAGE (/)
  // ----------------------------------------------------
  if (currentPath === '/') {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
        {/* HERO SECTION */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '40px', alignItems: 'center', marginBottom: '64px' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'inline-block', backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', color: '#C98262', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, marginBottom: '20px' }}>
              CHARTPIE • Private. Direct. Connected.
            </div>
            <h1 style={{ fontSize: '44px', fontWeight: 900, color: '#3B3530', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-0.5px' }}>
              Messaging built around your privacy.
            </h1>
            <p style={{ fontSize: '17px', color: '#81766C', lineHeight: '1.6', marginBottom: '32px' }}>
              Chartpie is a privacy-focused communication platform designed to combine direct peer-to-peer communication with protected synchronization across authorized devices.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/register')} className="auren-btn-primary" style={{ padding: '14px 32px', fontSize: '15px' }}>
                Create Your Account
              </button>
              <button onClick={() => navigate('/security')} style={{ padding: '14px 28px', border: '1px solid var(--border-warm)', borderRadius: '12px', background: '#FFFDF8', fontWeight: 700, cursor: 'pointer', color: '#3B3530', fontSize: '15px' }}>
                Explore Security
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '300px', textAlign: 'center' }}>
            <div className="warm-card" style={{ padding: '16px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(231, 162, 59, 0.15)' }}>
              <img
                src="/assets/hero_visual.png"
                alt="Chartpie Product Visual"
                style={{ width: '100%', height: 'auto', borderRadius: '16px', display: 'block' }}
              />
            </div>
          </div>
        </div>

        <PublicAdSlot label="SPONSORED INFRASTRUCTURE" format="banner" />

        {/* SECTION — WHY CHARTPIE? (4 CARDS) */}
        <div style={{ margin: '64px 0', textAlign: 'center' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#3B3530', marginBottom: '16px' }}>
            Messaging should connect people without making privacy an afterthought.
          </h2>
          <p style={{ color: '#81766C', fontSize: '15px', maxWidth: '640px', margin: '0 auto 40px auto' }}>
            Chartpie is engineered around user control, client-side protection, and independent device authorizations.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px', textAlign: 'left' }}>
            <div className="warm-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔒</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '8px' }}>PRIVATE</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', margin: 0 }}>
                Chartpie is designed around protecting message content before synchronization.
              </p>
            </div>

            <div className="warm-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚡</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '8px' }}>DIRECT</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', margin: 0 }}>
                Where network conditions permit, Chartpie can establish direct peer-to-peer connections.
              </p>
            </div>

            <div className="warm-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔄</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '8px' }}>CONNECTED</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', margin: 0 }}>
                Authorized devices can synchronize protected conversation data seamlessly.
              </p>
            </div>

            <div className="warm-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚙️</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '8px' }}>CONTROLLED</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', margin: 0 }}>
                Users can manage profiles, authorized devices, contact aliases, and account security.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION — HOW CHARTPIE DIFFERS */}
        <div className="warm-card" style={{ padding: '40px', margin: '64px 0', borderRadius: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#3B3530', marginBottom: '24px', textAlign: 'center' }}>
            Different from the way you usually message.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: '#FFF9EF', padding: '24px', borderRadius: '16px', border: '1px solid #E9DED1' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#C98262', marginBottom: '12px' }}>SOCIAL-FIRST PLATFORMS</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.6', margin: 0 }}>
                Often combine messaging with endless recommendation feeds, public content discovery, advertisement ecosystems, and central data profiling.
              </p>
            </div>

            <div style={{ backgroundColor: '#FFF9EF', padding: '24px', borderRadius: '16px', border: '1px solid #E9DED1' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#C98262', marginBottom: '12px' }}>MESSAGING-FIRST PLATFORMS</h3>
              <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.6', margin: 0 }}>
                Focus primarily on group communication, calls, and central servers holding full routing records and cloud archives.
              </p>
            </div>

            <div style={{ backgroundColor: '#FFFDF8', padding: '24px', borderRadius: '16px', border: '2px solid #E7A23B', boxShadow: '0 4px 14px rgba(231, 162, 59, 0.15)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#E7A23B', marginBottom: '12px' }}>CHARTPIE APPROACH</h3>
              <p style={{ fontSize: '13px', color: '#3B3530', lineHeight: '1.6', margin: 0, fontWeight: 600 }}>
                Designed around private communication, direct peer connections where available, encrypted synchronization, authorized device sessions, contact aliases, and privacy-focused architecture.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION — WHY NOT A SOCIAL FEED? */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '40px', alignItems: 'center', margin: '64px 0' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#3B3530', marginBottom: '16px' }}>
              Why not a social feed?
            </h2>
            <p style={{ fontSize: '15px', color: '#81766C', lineHeight: '1.6', marginBottom: '16px' }}>
              Chartpie is designed around conversations rather than an endless social feed.
            </p>
            <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.6' }}>
              No recommendation feed is required to start a conversation. Your contacts, your conversations, and your devices remain the center of the experience.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: '280px', backgroundColor: '#FFF9EF', padding: '28px', borderRadius: '20px', border: '1px solid #E9DED1', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#3B3530', marginBottom: '16px' }}>
              Direct Conversation Model
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px 20px', backgroundColor: '#FFFDF8', borderRadius: '10px', border: '1px solid #E7A23B', fontWeight: 700, fontSize: '13px' }}>👤 User Endpoint</div>
              <div style={{ color: '#E7A23B', fontWeight: 900 }}>↓</div>
              <div style={{ padding: '10px 20px', backgroundColor: '#E7A23B', color: '#FFFDF8', borderRadius: '10px', fontWeight: 800, fontSize: '13px' }}>🔒 Protected Conversation</div>
              <div style={{ color: '#E7A23B', fontWeight: 900 }}>↓</div>
              <div style={{ padding: '10px 20px', backgroundColor: '#FFFDF8', borderRadius: '10px', border: '1px solid #E7A23B', fontWeight: 700, fontSize: '13px' }}>📱 Authorized Devices</div>
            </div>
          </div>
        </div>

        {/* SECTION — MULTI-DEVICE */}
        <div style={{ textAlign: 'center', margin: '64px 0' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#3B3530', marginBottom: '12px' }}>
            One identity. Your authorized devices.
          </h2>
          <p style={{ color: '#81766C', fontSize: '15px', marginBottom: '32px' }}>
            Web • Android • iOS • Windows • macOS • Linux
          </p>
          <div className="warm-card" style={{ padding: '20px', borderRadius: '24px', maxWidth: '720px', margin: '0 auto' }}>
            <img src="/assets/multidevice_visual.png" alt="Multi-device illustration" style={{ width: '100%', borderRadius: '16px', display: 'block' }} />
          </div>
        </div>

        {/* SECTION — PRIVACY ARCHITECTURE */}
        <div style={{ textAlign: 'center', margin: '64px 0' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#3B3530', marginBottom: '12px' }}>
            Privacy Architecture
          </h2>
          <p style={{ color: '#81766C', fontSize: '15px', marginBottom: '32px' }}>
            Message → Client-side Protection → Encrypted Payload → Synchronization → Protected Storage
          </p>
          <div className="warm-card" style={{ padding: '20px', borderRadius: '24px', maxWidth: '720px', margin: '0 auto' }}>
            <img src="/assets/security_visual.png" alt="Privacy architecture illustration" style={{ width: '100%', borderRadius: '16px', display: 'block' }} />
          </div>
        </div>

        {/* CALL TO ACTION */}
        <div className="warm-card" style={{ padding: '48px 32px', textAlign: 'center', borderRadius: '24px', margin: '64px 0', backgroundColor: '#FFF9EF', border: '1px solid #E9DED1' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#3B3530', marginBottom: '16px' }}>
            Start with a conversation, not a profile feed.
          </h2>
          <p style={{ fontSize: '15px', color: '#81766C', marginBottom: '28px' }}>
            Join Chartpie today and experience private, direct communication.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/register')} className="auren-btn-primary" style={{ padding: '14px 32px', fontSize: '15px' }}>
              Create Account
            </button>
            <button onClick={() => navigate('/login')} style={{ padding: '14px 28px', border: '1px solid var(--border-warm)', borderRadius: '12px', background: '#FFFDF8', fontWeight: 700, cursor: 'pointer', color: '#3B3530', fontSize: '15px' }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. FEATURES PAGE (/features)
  // ----------------------------------------------------
  if (currentPath === '/features') {
    const FEATURES_LIST = [
      { icon: '💬', title: 'Private Messaging', desc: 'End-to-end encrypted messaging where text payloads are transformed before transmission, keeping message contents unreadable to unauthorized entities.' },
      { icon: '🔄', title: 'Encrypted Synchronization', desc: 'Protected conversation history syncs across your verified endpoints via zero-knowledge database synchronization.' },
      { icon: '🌐', title: 'Peer-to-Peer Communication', desc: 'Direct WebRTC data channels for real-time text and media delivery whenever peers are online on accessible networks.' },
      { icon: '💻', title: 'Multi-Device Access', desc: 'Link mobile phones, tablets, laptops, and web browsers under your single Chartpie user identity.' },
      { icon: '🔍', title: 'User Search', desc: 'Locate contacts directly via Chartpie username or User ID without exposing your entire address book.' },
      { icon: '📜', title: 'Persistent Conversations', desc: 'Conversations persist across sessions with client-side key storage protecting history accessibility.' },
      { icon: '●', title: 'Presence Status', desc: 'Real-time online status and heartbeat telemetry showing active connection state of your peers.' },
      { icon: '👤', title: 'Profile Customization', desc: 'Update display name, avatar picture, and email address with immediate database synchronization.' },
      { icon: '⚙️', title: 'Device Management', desc: 'View all active logged-in device sessions and revoke unauthorized sessions in one click.' },
      { icon: '🔑', title: 'Two-Step Verification', desc: 'Enhance your account authentication with TOTP authenticator apps (Google Authenticator, Authy).' },
      { icon: '📱', title: 'QR Device Login', desc: 'Instant single-use QR pairing to authorize laptop web browser sessions using your mobile phone.' },
      { icon: '🖼️', title: 'Media & Image Sharing', desc: 'Drag-and-drop or select images with full client-side AES-GCM payload encryption before upload.' },
      { icon: '🏷️', title: 'Contact Aliases', desc: 'Assign local contact names (e.g., "Rahul - College") per account without altering global public profiles.' },
      { icon: '⚡', title: 'PWA & Native Apps', desc: 'Install as a standalone PWA on desktop web or run cross-platform Flutter native applications.' },
    ];

    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', color: '#C98262', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, marginBottom: '16px' }}>
            CHARTPIE CAPABILITIES
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#3B3530', marginBottom: '16px' }}>
            Everything you need to stay connected.
          </h1>
          <p style={{ color: '#81766C', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
            Explore the comprehensive feature suite built into Chartpie for private, direct, and multi-device communication.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {FEATURES_LIST.map((feat) => (
            <div key={feat.title} className="warm-card" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '28px' }}>{feat.icon}</div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#3B3530' }}>{feat.title}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#81766C', lineHeight: '1.6' }}>{feat.desc}</p>
            </div>
          ))}
        </div>

        <PublicAdSlot label="POWER YOUR MESSAGING" format="banner" />
      </div>
    );
  }

  // ----------------------------------------------------
  // 3. SECURITY PAGE (/security)
  // ----------------------------------------------------
  if (currentPath === '/security') {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', color: '#C98262', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, marginBottom: '16px' }}>
            ARCHITECTURE & DEFENSE
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#3B3530', marginBottom: '16px' }}>
            Security is part of the architecture.
          </h1>
          <p style={{ color: '#81766C', fontSize: '16px', maxWidth: '680px', margin: '0 auto' }}>
            Chartpie is built on client-side encryption primitives, zero-knowledge backend constraints, and authorized device isolation.
          </p>
        </div>

        {/* 11 TECHNICAL SECTIONS */}
        <div className="warm-card" style={{ padding: '36px', borderRadius: '20px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', marginBottom: '20px' }}>
            1. End-to-End Message Protection
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Message payloads are encrypted on the sending device before transmission. The backend server acts as a zero-knowledge relay and synchronization store, storing only encrypted payloads and Initialization Vectors (IV).
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            2. Ciphertext Synchronization Model
          </h2>
          <div style={{ backgroundColor: '#FFF9EF', padding: '20px', borderRadius: '12px', border: '1px solid #E9DED1', fontSize: '13px', fontWeight: 700, color: '#3B3530', textAlign: 'center', marginBottom: '16px' }}>
            Plaintext Input → WebCrypto AES-GCM → Base64 Ciphertext Payload → Backend Storage → Peer Client Decryption
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            3. Conversation Encryption Keys
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Each direct conversation utilizes an isolated conversation key. Conversation keys are wrapped in encrypted key envelopes for each authorized conversation member.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            4. User Authentication & Password Hashing
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            User credentials are authenticated using salted password hashing, combined with phone OTP verification and session token authentication.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            5. Two-Step Verification (TOTP)
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Chartpie supports Time-based One-Time Password (TOTP) standards compatible with Google Authenticator, Authy, and 1Password, plus hashed recovery codes.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            6. Authorized Device Management
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Every endpoint (browser, desktop, mobile) registers a unique device session. Users can audit active sessions and revoke unknown devices instantly.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            7. One-Time QR Device Pairing
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Desktop QR login uses short-lived single-use pairing challenges. Authenticated mobile phones scan and approve pairing without exposing static passwords over QR.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            8. Network Transport Security
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            All REST API and WebSocket signaling traffic enforces TLS encryption (HTTPS / WSS in production).
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            9. Peer-to-Peer STUN/TURN & WebRTC
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            Direct data channels utilize WebRTC ICE candidate negotiation. STUN/TURN servers facilitate NAT traversal for peer-to-peer data flow.
          </p>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', margin: '32px 0 20px 0' }}>
            10. Zero-Plaintext Backend Enforcement
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7' }}>
            The backend API strictly rejects any incoming message payload containing unencrypted text fields (`plaintext`, `message_text`, `content`).
          </p>
        </div>

        {/* HONEST LIMITATIONS SECTION */}
        <div style={{ backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', padding: '32px', borderRadius: '20px', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#C98262', marginBottom: '12px' }}>
            What Chartpie does not claim
          </h2>
          <p style={{ fontSize: '14px', color: '#81766C', lineHeight: '1.7', margin: 0 }}>
            Security is an ongoing engineering process. Chartpie does not claim to be impossible to compromise, and security guarantees depend on correct implementation, endpoint device security, OS protection, network security, and future independent audit reviews.
          </p>
        </div>

        {/* COMPARISON TABLE */}
        <div className="warm-card" style={{ padding: '32px', borderRadius: '20px', marginBottom: '40px', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#3B3530', marginBottom: '20px' }}>
            How Chartpie approaches privacy
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E9DED1', color: '#3B3530' }}>
                <th style={{ padding: '12px' }}>Category</th>
                <th style={{ padding: '12px', color: '#E7A23B' }}>Chartpie Approach</th>
                <th style={{ padding: '12px' }}>Traditional Social Platforms</th>
                <th style={{ padding: '12px' }}>General Messaging Architecture</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E9DED1' }}>
                <td style={{ padding: '12px', fontWeight: 700 }}>Primary Purpose</td>
                <td style={{ padding: '12px', color: '#3B3530', fontWeight: 600 }}>Private messaging & sync</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Social feeds & ad engagement</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Centralized messaging</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E9DED1' }}>
                <td style={{ padding: '12px', fontWeight: 700 }}>Device Control</td>
                <td style={{ padding: '12px', color: '#3B3530', fontWeight: 600 }}>User-audited session revocation</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Account bound to central phone</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Varies by provider</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E9DED1' }}>
                <td style={{ padding: '12px', fontWeight: 700 }}>Encryption Architecture</td>
                <td style={{ padding: '12px', color: '#3B3530', fontWeight: 600 }}>Client-side WebCrypto AES-GCM</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Server-side cloud storage</td>
                <td style={{ padding: '12px', color: '#81766C' }}>End-to-end or TLS transit</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E9DED1' }}>
                <td style={{ padding: '12px', fontWeight: 700 }}>P2P Capability</td>
                <td style={{ padding: '12px', color: '#3B3530', fontWeight: 600 }}>WebRTC direct channels</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Central server routing only</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Calls P2P, messages server</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', fontWeight: 700 }}>Contact Aliases</td>
                <td style={{ padding: '12px', color: '#3B3530', fontWeight: 600 }}>Account-scoped local aliases</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Global address book sync</td>
                <td style={{ padding: '12px', color: '#81766C' }}>Device phonebook mapping</td>
              </tr>
            </tbody>
          </table>
        </div>

        <PublicAdSlot label="SECURITY HARDENING" format="banner" />
      </div>
    );
  }

  // ----------------------------------------------------
  // 4. HELP PAGE (/help)
  // ----------------------------------------------------
  if (currentPath === '/help') {
    const FAQS = [
      { q: 'What is Chartpie?', a: 'Chartpie is a privacy-focused P2P and encrypted synchronization messaging application built to keep your communication private and multi-device accessible.' },
      { q: 'Does Chartpie use P2P?', a: 'Yes. Where network conditions allow NAT traversal via STUN/ICE, Chartpie establishes direct WebRTC DataChannels for real-time text and media delivery.' },
      { q: 'Where are messages stored?', a: 'Messages are stored in encrypted format on your authorized local devices and synchronized via a zero-knowledge PostgreSQL backend relay.' },
      { q: 'Can I use multiple devices?', a: 'Yes. You can link multiple devices (web browser, mobile, desktop) under one Chartpie user identity.' },
      { q: 'What is Two-Step Verification?', a: 'Two-Step Verification adds an additional layer of security using time-based OTP authenticator apps like Google Authenticator.' },
      { q: 'What is QR device login?', a: 'QR login allows you to securely sign in to a desktop browser session by scanning a QR code with your already authenticated Chartpie mobile phone.' },
      { q: 'How do contact aliases work?', a: 'Contact aliases allow you to set custom names for your contacts (e.g. "Rahul - College"). These aliases are stored locally on your account and do not alter the other user\'s global profile.' },
    ];

    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', color: '#C98262', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, marginBottom: '16px' }}>
            CHARTPIE HELP CENTER
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#3B3530', marginBottom: '16px' }}>
            Need a hand with Chartpie?
          </h1>
          <p style={{ color: '#81766C', fontSize: '16px', maxWidth: '600px', margin: '0 auto 24px auto' }}>
            Find guides, troubleshooting steps, and answers to frequently asked questions.
          </p>

          <input
            className="auren-input"
            type="text"
            placeholder="Search help topics, guides, FAQs..."
            value={helpSearch}
            onChange={(e) => setHelpSearch(e.target.value)}
            style={{ maxWidth: '480px', margin: '0 auto', padding: '12px 18px', fontSize: '14px', borderRadius: '12px' }}
          />
        </div>

        {/* GETTING STARTED & HOW TOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
          <div className="warm-card" style={{ padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '12px' }}>🚀 Getting Started</h3>
            <ul style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
              <li>Creating a Chartpie account</li>
              <li>Verifying phone number via MSG91 OTP</li>
              <li>Signing in to your account</li>
              <li>Starting your first direct conversation</li>
              <li>Searching users by username or User ID</li>
            </ul>
          </div>

          <div className="warm-card" style={{ padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '12px' }}>⚙️ Profile & Security</h3>
            <ul style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
              <li>Editing your display name and photo</li>
              <li>Enabling Two-Step Verification (TOTP)</li>
              <li>Scanning desktop QR login codes</li>
              <li>Managing and revoking linked devices</li>
              <li>Using custom contact name aliases</li>
            </ul>
          </div>

          <div className="warm-card" style={{ padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#3B3530', marginBottom: '12px' }}>🛠️ Troubleshooting</h3>
            <ul style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
              <li>OTP verification code not received</li>
              <li>Login or session expiration issues</li>
              <li>Messages failing to decrypt or sync</li>
              <li>QR pairing code timeout</li>
              <li>Image file upload size limit (max 5MB)</li>
            </ul>
          </div>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <div className="warm-card" style={{ padding: '36px', borderRadius: '20px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#3B3530', marginBottom: '24px' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {FAQS.filter(f => f.q.toLowerCase().includes(helpSearch.toLowerCase()) || f.a.toLowerCase().includes(helpSearch.toLowerCase())).map(faq => (
              <div key={faq.q} style={{ borderBottom: '1px solid #E9DED1', paddingBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, color: '#3B3530' }}>{faq.q}</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#81766C', lineHeight: '1.6' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <PublicAdSlot label="HELP & SUPPORT" format="banner" />
      </div>
    );
  }

  // ----------------------------------------------------
  // 5. DOWNLOAD PAGE (/download)
  // ----------------------------------------------------
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ marginBottom: '48px' }}>
        <div style={{ display: 'inline-block', backgroundColor: '#FFF9EF', border: '1px solid #E7A23B', color: '#C98262', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, marginBottom: '16px' }}>
          CROSS-PLATFORM CLIENTS
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#3B3530', marginBottom: '16px' }}>
          Chartpie everywhere you connect.
        </h1>
        <p style={{ color: '#81766C', fontSize: '16px', maxWidth: '640px', margin: '0 auto' }}>
          Install Chartpie across all your endpoints. All clients share the exact same zero-knowledge backend and identity infrastructure.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', textAlign: 'left', marginBottom: '48px' }}>
        <div className="warm-card" style={{ padding: '28px', borderRadius: '18px', border: '2px solid #E7A23B' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌐</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>Chartpie Web App / PWA</h3>
          <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', marginBottom: '20px' }}>
            Install directly into Chrome, Edge, Safari, or Brave as a standalone desktop web app.
          </p>
          {deferredPrompt ? (
            <button onClick={() => deferredPrompt.prompt()} className="auren-btn-primary" style={{ width: '100%', padding: '10px 18px', fontSize: '13px' }}>
              Install PWA Web App
            </button>
          ) : (
            <button onClick={() => navigate('/app/chats')} className="auren-btn-primary" style={{ width: '100%', padding: '10px 18px', fontSize: '13px' }}>
              Launch Web Client
            </button>
          )}
        </div>

        <div className="warm-card" style={{ padding: '28px', borderRadius: '18px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>Chartpie Android</h3>
          <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', marginBottom: '20px' }}>
            Native Flutter mobile application for Android smartphones and tablets.
          </p>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#C98262', background: '#FFF9EF', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
            Native Build Ready (lib/)
          </span>
        </div>

        <div className="warm-card" style={{ padding: '28px', borderRadius: '18px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🍎</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>Chartpie iOS</h3>
          <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', marginBottom: '20px' }}>
            Native Flutter mobile application for Apple iPhone and iPad devices.
          </p>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#C98262', background: '#FFF9EF', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
            Native Build Ready (lib/)
          </span>
        </div>

        <div className="warm-card" style={{ padding: '28px', borderRadius: '18px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💻</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#3B3530' }}>Chartpie Desktop</h3>
          <p style={{ fontSize: '13px', color: '#81766C', lineHeight: '1.5', marginBottom: '20px' }}>
            Native Flutter desktop applications for Windows, macOS, and Linux.
          </p>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#C98262', background: '#FFF9EF', padding: '6px 14px', borderRadius: '8px', display: 'inline-block' }}>
            Desktop Build Target
          </span>
        </div>
      </div>

      <PublicAdSlot label="ECOSYSTEM CLIENTS" format="banner" />
    </div>
  );
};
