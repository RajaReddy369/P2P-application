# P2P Messenger (Flutter + WebRTC)

A WhatsApp-inspired peer-to-peer mobile messaging application engineered to demonstrate Computer Networks concepts: WebRTC DataChannels, SRTP Media Streams, ICE/STUN/TURN NAT Traversal, Double Ratchet E2EE, and Offline Message Queueing.

---

## Traffic Breakdown (Rule 19 Compliance)

| Traffic Type | Pathway / Protocol | Destination | Data Stored on Infrastructure? |
| :--- | :--- | :--- | :--- |
| **Peer Signaling** | WebSocket over TLS (`wss://`) | Node.js Signaling Broker | **NO.** Transient SDP & ICE candidate relay only. Zero message text or media storage. |
| **STUN Discovery** | UDP STUN Binding Requests | Google STUN / Coturn | **NO.** Returns public IP & port mapping (`srflx`). |
| **TURN Relaying** | UDP / TCP TURN Relay Protocol | Coturn Server | **NO.** Encrypted fallback relaying when direct P2P is blocked by symmetric NATs. |
| **Text Messages** | WebRTC SCTP DataChannel (UDP) | Direct Peer Device | **NO.** 100% Peer-to-Peer, E2E Encrypted. Saved locally in SQLite. |
| **Files & Images** | Chunked 64KB SCTP DataChannel | Direct Peer Device | **NO.** 100% Peer-to-Peer stream reassembly. |
| **Voice & Video** | WebRTC SRTP Media Streams (UDP) | Direct Peer Device | **NO.** Low-latency direct media exchange. |

---

## 13-Phase Roadmap Status

- [x] **Phase 1: Flutter application shell.**
- [x] **Phase 2: Local database.**
- [x] **Phase 3: Peer identity.**
- [x] **Phase 4: LAN peer communication.**
- [x] **Phase 5: WebRTC DataChannel.**
- [x] **Phase 6: Internet signaling.**
- [ ] Phase 7: STUN/ICE.
- [ ] Phase 8: TURN fallback.
- [ ] Phase 9: Encrypted messaging.
- [ ] Phase 10: Image/file transfer.
- [ ] Phase 11: Voice/video.
- [ ] Phase 12: Offline queue and reconnection.
- [ ] Phase 13: Decentralized discovery.

---

## Architecture Rules Enforced

1. Zero central chat database.
2. Zero server message or media storage.
3. Decoupled UI, Networking, Cryptography, and Persistence layers.
4. Structured logging on all networking features (`P2PLogger`).
5. Automated test suite for networking components.
