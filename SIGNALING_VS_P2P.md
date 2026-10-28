# Signaling Traffic vs. Actual P2P Application Traffic

This document provides architectural documentation detailing the distinct separation between **Signaling Infrastructure Traffic** and **Direct Peer-to-Peer (P2P) Application Traffic** in the P2P Messenger system.

---

## 1. Architectural Overview

In a zero-server Peer-to-Peer architecture, WebRTC endpoints cannot connect to each other directly on the Internet without first discovering each other's network addresses and capabilities. 

- **Signaling Server**: Acts as an **ephemeral matchmaker broker** operating via WebSocket (`ws://` / `wss://`). It ONLY relays initial metadata (peer IDs, SDP session descriptions, ICE network candidates).
- **Direct P2P DataChannels**: Once SDP negotiation and ICE candidate pairing complete, the WebRTC SCTP DataChannel opens directly between the two peer devices. **ALL text messages, file attachments, and media streams flow exclusively through this direct P2P connection.**

```
+-----------------------------------------------------------------------+
|                        PHASE 1: SIGNALING PHASE                       |
|                                                                       |
|  [Peer Device A] ===== (WebSocket: SDP / ICE / Room) ===== [Server]   |
|                                                               ^       |
|  [Peer Device B] ===== (WebSocket: SDP / ICE / Room) =========+       |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    PHASE 2: DIRECT P2P MESSAGING PHASE                |
|                                                                       |
|  [Peer Device A] <=====================================> [Peer B]    |
|                      WebRTC SCTP DataChannel (UDP)                    |
|                      Direct E2E Encrypted Payload                     |
|                                                                       |
|  * SERVER IS NO LONGER INVOLVED. ZERO MESSAGES OR MEDIA HIT SERVER.   |
+-----------------------------------------------------------------------+
```

---

## 2. Comparative Matrix

| Feature / Dimension | Signaling Traffic (Infrastructure) | Direct P2P Application Traffic |
| :--- | :--- | :--- |
| **Primary Purpose** | WebRTC Session Bootstrapping & NAT Discovery | Actual Chat Messaging, File Sharing, Voice/Video |
| **Transport Layer** | WebSocket (`ws://` or `wss://`) over TCP | WebRTC SCTP DataChannel / SRTP over UDP |
| **Infrastructure Node** | Node.js Signaling Broker (`server.js`) | Direct Peer Device Sockets (Zero Server) |
| **Data Types Relayed** | `room_id`, `peer_id`, `sdp_offer`, `sdp_answer`, `ice_candidate` | Text messages, 64KB file chunks, E2EE keys |
| **Server Persistence** | **ZERO Storage** (In-memory ephemeral maps only) | **Local Device Storage** (SQLite `p2p_messenger.db`) |
| **Message Confidentiality** | Ephemeral JSON routing | End-to-End Encrypted (Curve25519 & AES-256-GCM) |
| **Bandwidth & Load** | Ultra-Lightweight (Kilobytes of text metadata) | High Throughput (Megabytes/Gigabytes of data) |
| **Connection Lifecycle** | Active only during room joining & ICE exchange | Active continuously during active chat session |

---

## 3. Detailed Traffic Analysis

### A. Signaling Traffic Breakdown

1. **Room Creation & Joining (`create_room` / `join_room`)**:
   - Peers connect to the WebSocket signaling server and request to join a common room identifier.
   - The server maintains ephemeral in-memory socket pointers while the room is active.

2. **Session Description Protocol Exchange (`sdp_offer` / `sdp_answer`)**:
   - Device A creates a local SDP Offer describing supported codecs, encryption ciphers, and DataChannel options.
   - Device A sends this SDP Offer JSON to the signaling server, which immediately forwards it to Device B.
   - Device B receives the offer, sets its remote description, creates an SDP Answer JSON, and sends it back through the signaling server to Device A.

3. **Interactive Connectivity Establishment (`ice_candidate`)**:
   - Both devices query STUN servers to discover their public IP and port mappings (`srflx`).
   - Devices transmit these candidate addresses (`candidate:1 1 UDP ...`) through the signaling server to each other.

4. **Teardown & Cleanup (`leave_room` / `peer_left`)**:
   - When a peer leaves or disconnects, the server immediately purges all associated memory pointers and notifies remaining room members.
   - **Zero traces of message content, media, or chat history exist on the signaling server.**

---

### B. P2P Application Traffic Breakdown

1. **WebRTC SCTP DataChannel**:
   - Once ICE candidates succeed, a direct peer-to-peer connection is established.
   - Text chat messages are formatted as `ChatMessage` models and sent directly socket-to-socket over UDP.

2. **File & Image Transfer**:
   - Files are split into 64KB binary chunks and transmitted directly across the SCTP DataChannel.
   - Reassembly occurs in memory on the recipient device and is saved to local storage.

3. **Local Persistence**:
   - Chat history remains strictly on the user's physical device inside SQLite database tables (`messages`, `conversations`, `message_attachments`).
   - Neither the signaling server nor any central cloud instance ever sees, handles, or stores chat messages or user media.

---

## 4. Security & Privacy Guarantees

- **No Eavesdropping on Chat Content**: Even if an attacker monitors signaling WebSocket traffic, they only see SDP session parameters and network candidate IPs. They cannot read chat messages, view images, or intercept files because all application data is transmitted directly over WebRTC DataChannels.
- **Zero Central Database**: The signaling server runs without any database connection (No MongoDB, No Firebase, No MySQL). It operates purely as an ephemeral message router.
