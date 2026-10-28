/**
 * Minimal Zero-Storage WebSocket Signaling Broker for P2P WebRTC Messenger.
 * 
 * STRICT RULES ENFORCED:
 * 1. ONLY exchanges peer IDs, SDP offers, SDP answers, ICE candidates, and room info.
 * 2. ZERO chat message storage.
 * 3. ZERO media/file storage.
 * 4. ZERO persistent database.
 * 5. Ephemeral in-memory socket routing only.
 */

const { WebSocketServer, WebSocket } = require('ws');

class SignalingServer {
  constructor(port = 8080) {
    this.port = port;
    this.wss = null;
    // Memory map: roomId -> Map<peerId, { ws, peerId, displayName }>
    this.rooms = new Map();
    // Memory map: ws -> { roomId, peerId }
    this.clientSockets = new Map();
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });
    this.log('INFO', `WebSocket Signaling Server listening on ws://0.0.0.0:${this.port}`);

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      this.log('SIGNAL', `Client connected from ${clientIp}`);

      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        this.log('ERROR', `Socket error: ${err.message}`);
        this.handleDisconnect(ws);
      });
    });

    return this.wss;
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.rooms.clear();
      this.clientSockets.clear();
      this.log('INFO', 'Signaling server stopped');
    }
  }

  handleMessage(ws, rawData) {
    let payload;
    try {
      payload = JSON.parse(rawData.toString());
    } catch (_) {
      return this.sendError(ws, 'INVALID_JSON', 'Malformed JSON payload string');
    }

    const { type, room_id, peer_id, sender_id, target_id, sdp, candidate, display_name } = payload;
    const effectivePeerId = sender_id || peer_id;

    if (!type) {
      return this.sendError(ws, 'MISSING_TYPE', "Field 'type' is required");
    }

    switch (type) {
      case 'create_room':
        this.handleCreateRoom(ws, room_id, effectivePeerId, display_name);
        break;
      case 'join_room':
        this.handleJoinRoom(ws, room_id, effectivePeerId, display_name);
        break;
      case 'sdp_offer':
        this.handleSdpOffer(ws, room_id, effectivePeerId, target_id, sdp);
        break;
      case 'sdp_answer':
        this.handleSdpAnswer(ws, room_id, effectivePeerId, target_id, sdp);
        break;
      case 'ice_candidate':
        this.handleIceCandidate(ws, room_id, effectivePeerId, target_id, candidate);
        break;
      case 'leave_room':
        this.handleLeaveRoom(ws, room_id, effectivePeerId);
        break;
      default:
        this.sendError(ws, 'UNKNOWN_TYPE', `Unsupported message type '${type}'`);
        break;
    }
  }

  handleCreateRoom(ws, roomId, peerId, displayName = 'Peer') {
    if (!roomId || !peerId) {
      return this.sendError(ws, 'INVALID_PARAMS', "Both 'room_id' and 'peer_id' (or 'sender_id') are required");
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const room = this.rooms.get(roomId);
    room.set(peerId, { ws, peerId, displayName });
    this.clientSockets.set(ws, { roomId, peerId });

    this.log('SIGNAL', `Peer ${peerId} created signaling room '${roomId}'`);
    this.sendJson(ws, {
      type: 'room_created',
      room_id: roomId,
      peer_id: peerId,
    });
  }

  handleJoinRoom(ws, roomId, peerId, displayName = 'Peer') {
    if (!roomId || !peerId) {
      return this.sendError(ws, 'INVALID_PARAMS', "Both 'room_id' and 'peer_id' (or 'sender_id') are required");
    }

    if (!this.rooms.has(roomId)) {
      return this.sendError(ws, 'ROOM_NOT_FOUND', `Signaling room '${roomId}' does not exist`);
    }

    const room = this.rooms.get(roomId);
    const existingPeers = Array.from(room.keys());

    room.set(peerId, { ws, peerId, displayName });
    this.clientSockets.set(ws, { roomId, peerId });

    this.log('SIGNAL', `Peer ${peerId} joined signaling room '${roomId}' (Existing peers: ${existingPeers.length})`);

    // Notify joiner
    this.sendJson(ws, {
      type: 'room_joined',
      room_id: roomId,
      peer_id: peerId,
      existing_peers: existingPeers,
    });

    // Broadcast peer_joined to existing room members
    for (const [id, peer] of room.entries()) {
      if (id !== peerId && peer.ws.readyState === WebSocket.OPEN) {
        this.sendJson(peer.ws, {
          type: 'peer_joined',
          room_id: roomId,
          peer_id: peerId,
          display_name: displayName,
        });
      }
    }
  }

  handleSdpOffer(ws, roomId, senderId, targetId, sdp) {
    if (!roomId || !senderId || !sdp) {
      return this.sendError(ws, 'INVALID_SDP', "Fields 'room_id', 'sender_id' (or 'peer_id'), and 'sdp' are required");
    }

    this.log('SIGNAL', `Relaying SDP Offer from ${senderId} -> ${targetId || 'room'} in room '${roomId}'`);
    this.relayToPeerOrRoom(ws, roomId, senderId, targetId, {
      type: 'sdp_offer',
      room_id: roomId,
      sender_id: senderId,
      sdp: sdp,
    });
  }

  handleSdpAnswer(ws, roomId, senderId, targetId, sdp) {
    if (!roomId || !senderId || !sdp) {
      return this.sendError(ws, 'INVALID_SDP', "Fields 'room_id', 'sender_id' (or 'peer_id'), and 'sdp' are required");
    }

    this.log('SIGNAL', `Relaying SDP Answer from ${senderId} -> ${targetId || 'room'} in room '${roomId}'`);
    this.relayToPeerOrRoom(ws, roomId, senderId, targetId, {
      type: 'sdp_answer',
      room_id: roomId,
      sender_id: senderId,
      sdp: sdp,
    });
  }

  handleIceCandidate(ws, roomId, senderId, targetId, candidate) {
    if (!roomId || !senderId || !candidate) {
      return this.sendError(ws, 'INVALID_ICE', "Fields 'room_id', 'sender_id' (or 'peer_id'), and 'candidate' are required");
    }

    this.log('SIGNAL', `Relaying ICE Candidate from ${senderId} -> ${targetId || 'room'} in room '${roomId}'`);
    this.relayToPeerOrRoom(ws, roomId, senderId, targetId, {
      type: 'ice_candidate',
      room_id: roomId,
      sender_id: senderId,
      candidate: candidate,
    });
  }

  handleLeaveRoom(ws, roomId, peerId) {
    this.removeClientFromRoom(ws, roomId, peerId);
  }

  handleDisconnect(ws) {
    const meta = this.clientSockets.get(ws);
    if (meta) {
      this.removeClientFromRoom(ws, meta.roomId, meta.peerId);
      this.clientSockets.delete(ws);
    }
  }

  removeClientFromRoom(ws, roomId, peerId) {
    if (!roomId || !this.rooms.has(roomId)) return;

    const room = this.rooms.get(roomId);
    if (room && room.has(peerId)) {
      room.delete(peerId);
      this.log('SIGNAL', `Peer ${peerId} left signaling room '${roomId}'`);

      // Notify remaining peers in room
      for (const [id, peer] of room.entries()) {
        if (peer.ws.readyState === WebSocket.OPEN) {
          this.sendJson(peer.ws, {
            type: 'peer_left',
            room_id: roomId,
            peer_id: peerId,
          });
        }
      }

      if (room.size === 0) {
        this.rooms.delete(roomId);
        this.log('SIGNAL', `Cleaned up empty room '${roomId}'`);
      }
    }
  }

  relayToPeerOrRoom(senderWs, roomId, senderId, targetId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return this.sendError(senderWs, 'ROOM_NOT_FOUND', `Room '${roomId}' not found`);
    }

    if (targetId && room.has(targetId)) {
      const targetPeer = room.get(targetId);
      if (targetPeer.ws.readyState === WebSocket.OPEN) {
        this.sendJson(targetPeer.ws, payload);
      }
    } else {
      // Broadcast to all other peers in room
      for (const [id, peer] of room.entries()) {
        if (id !== senderId && peer.ws.readyState === WebSocket.OPEN) {
          this.sendJson(peer.ws, payload);
        }
      }
    }
  }

  sendJson(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  sendError(ws, code, message) {
    this.sendJson(ws, {
      type: 'error',
      code: code,
      message: message,
    });
  }

  log(level, msg) {
    const time = new Date().toISOString().substring(11, 23);
    console.log(`[${time}] [${level}] ${msg}`);
  }
}

if (require.main === module) {
  const port = process.env.PORT || 8080;
  const server = new SignalingServer(port);
  server.start();
}

module.exports = SignalingServer;
