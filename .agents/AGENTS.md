# P2P Messenger Development Rules & Constraints (Hybrid P2P + Encrypted Central Synchronization)

## Architecture Rules
1. The application DOES use a central database (PostgreSQL) for storing encrypted conversation data, encrypted messages, encrypted attachment metadata, device registration, and synchronization state.
2. The central database MUST NEVER store plaintext message content, plaintext media (photos, videos, documents, audio, voice notes), private encryption keys, or a server-side master key capable of decrypting conversations.
3. Architecture is a Hybrid P2P + Encrypted Central Synchronization system. P2P (WebRTC DataChannels / MediaStreams) is used for normal real-time communication whenever peers are online.
4. The central backend (Node.js + Express/HTTP + WebSockets) is used for: authentication, user accounts, device registration, WebRTC signaling, encrypted conversation synchronization, encrypted message history, encrypted attachment synchronization, web application access, device management, and sync metadata.
5. Messages are decrypted ONLY on authorized client endpoints (user's mobile phone, user's authorized browser, user's authorized desktop/tablet). The backend must NEVER decrypt messages.
6. Use WebRTC for direct peer communication (WebRTC DataChannels for text and chunked file transfer, WebRTC MediaStreams for audio/video).
7. Use WebSockets for signaling (SDP offer/answer, ICE candidates) and real-time push notifications of new encrypted messages.
8. Keep networking logic separate from UI.
9. Keep cryptographic logic separate from UI.
10. Keep local persistence (SQLite on mobile, IndexedDB on web) separate from networking.
11. Never implement cryptographic algorithms from scratch. Use established, maintained cryptographic libraries (`cryptography` in Dart, `SubtleCrypto` Web Crypto API in JS, Node `crypto`).
12. Every networking and synchronization feature must have automated tests.
13. Every major networking feature must have structured logging.
14. Do NOT use Firebase.
15. Do NOT use Docker.
16. Handle network disconnections, offline queueing, and reconnection delta auto-synchronization.
17. Design file transfer using 16KB/64KB chunking with checksum verification and ACK resumption rather than loading huge files into memory.
18. Clearly document which traffic is direct P2P and which traffic travels through encrypted central infrastructure.

## 22-Phase Development Roadmap
1. PHASE 1  → Flutter UI (Completed)
2. PHASE 2  → SQLite (Completed)
3. PHASE 3  → Identity + Key Architecture (Completed)
4. PHASE 4  → Local/LAN Networking (Completed)
5. PHASE 5  → WebRTC DataChannel (Completed)
6. PHASE 6  → Signaling (Completed)
7. PHASE 7  → Internet P2P (Completed)
8. PHASE 8  → STUN/ICE/TURN (Completed)
9. PHASE 9  → E2E Encrypted Messages (Completed)
10. PHASE 10 → Encrypted Synchronization (Completed)
11. PHASE 11 → Node.js + PostgreSQL (Completed)
12. PHASE 12 → Encrypted Media/Files (Completed)
13. PHASE 13 → React Website (Completed)
14. PHASE 14 → Browser-side Decryption (Completed)
15. PHASE 15 → Browser ↔ P2P (Completed)
16. PHASE 16 → Voice/Video Calls (Completed)
17. PHASE 17 → Offline Synchronization (Completed)
18. PHASE 18 → Multi-Device (Completed)
19. PHASE 19 → Recovery (Completed)
20. PHASE 20 → Security Testing (Completed)
21. PHASE 21 → Network/Performance Testing (Completed)
22. PHASE 22 → Production Deployment (Completed)

*Rule: Never skip phases without testing the previous phase.*
