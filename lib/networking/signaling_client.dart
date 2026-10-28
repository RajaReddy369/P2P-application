import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'p2p_logger.dart';

/// Event wrapper for incoming signaling server notifications.
class SignalingEvent {
  final String type;
  final String? roomId;
  final String? peerId;
  final String? senderId;
  final String? targetId;
  final Map<String, dynamic>? sdp;
  final Map<String, dynamic>? candidate;
  final List<String> existingPeers;
  final String? errorMessage;

  const SignalingEvent({
    required this.type,
    this.roomId,
    this.peerId,
    this.senderId,
    this.targetId,
    this.sdp,
    this.candidate,
    this.existingPeers = const [],
    this.errorMessage,
  });
}

/// WebSocket Signaling Client for P2P WebRTC Session Bootstrapping (Phase 6).
/// Strictly relays transient SDP/ICE metadata. Never stores messages or media.
class SignalingClient {
  final P2PLogger _logger = P2PLogger('Signaling-Client');
  WebSocket? _socket;

  final StreamController<SignalingEvent> _eventController =
      StreamController<SignalingEvent>.broadcast();

  Stream<SignalingEvent> get eventStream => _eventController.stream;
  bool get isConnected => _socket != null && _socket!.readyState == WebSocket.open;

  /// Connects to WebSocket signaling server.
  Future<bool> connect(String serverUri) async {
    await disconnect();

    _logger.signaling('Connecting to WebSocket Signaling Broker: $serverUri');
    try {
      _socket = await WebSocket.connect(serverUri).timeout(const Duration(seconds: 5));
      _logger.signaling('WebSocket Signaling connection established with $serverUri');

      _socket!.listen(
        (data) => _handleIncomingMessage(data.toString()),
        onError: (err) {
          _logger.error('Signaling WebSocket error', err);
          disconnect();
        },
        onDone: () {
          _logger.signaling('Signaling WebSocket connection closed');
          disconnect();
        },
      );

      return true;
    } catch (e, st) {
      _logger.error('Failed to connect to signaling server $serverUri', e, st);
      return false;
    }
  }

  /// Sends request to create a signaling room.
  void createRoom(String roomId, String peerId, {String displayName = 'Peer'}) {
    _sendJson({
      'type': 'create_room',
      'room_id': roomId,
      'peer_id': peerId,
      'display_name': displayName,
    });
    _logger.signaling('Sent create_room request for room "$roomId"');
  }

  /// Sends request to join an existing signaling room.
  void joinRoom(String roomId, String peerId, {String displayName = 'Peer'}) {
    _sendJson({
      'type': 'join_room',
      'room_id': roomId,
      'peer_id': peerId,
      'display_name': displayName,
    });
    _logger.signaling('Sent join_room request for room "$roomId"');
  }

  /// Relays local SDP Offer description.
  void sendSdpOffer(String roomId, String senderId, String targetId, Map<String, dynamic> sdpMap) {
    _sendJson({
      'type': 'sdp_offer',
      'room_id': roomId,
      'sender_id': senderId,
      'target_id': targetId,
      'sdp': sdpMap,
    });
    _logger.signaling('Relayed SDP Offer for target peer "$targetId" in room "$roomId"');
  }

  /// Relays local SDP Answer description.
  void sendSdpAnswer(String roomId, String senderId, String targetId, Map<String, dynamic> sdpMap) {
    _sendJson({
      'type': 'sdp_answer',
      'room_id': roomId,
      'sender_id': senderId,
      'target_id': targetId,
      'sdp': sdpMap,
    });
    _logger.signaling('Relayed SDP Answer for target peer "$targetId" in room "$roomId"');
  }

  /// Relays local ICE Candidate address mapping.
  void sendIceCandidate(String roomId, String senderId, String targetId, Map<String, dynamic> candidateMap) {
    _sendJson({
      'type': 'ice_candidate',
      'room_id': roomId,
      'sender_id': senderId,
      'target_id': targetId,
      'candidate': candidateMap,
    });
    _logger.signaling('Relayed ICE Candidate for target peer "$targetId" in room "$roomId"');
  }

  /// Sends request to leave room.
  void leaveRoom(String roomId, String peerId) {
    _sendJson({
      'type': 'leave_room',
      'room_id': roomId,
      'peer_id': peerId,
    });
    _logger.signaling('Sent leave_room request for room "$roomId"');
  }

  void _handleIncomingMessage(String rawJson) {
    try {
      final json = jsonDecode(rawJson) as Map<String, dynamic>;
      final type = json['type'] as String? ?? 'unknown';

      final event = SignalingEvent(
        type: type,
        roomId: json['room_id'] as String?,
        peerId: json['peer_id'] as String?,
        senderId: json['sender_id'] as String?,
        targetId: json['target_id'] as String?,
        sdp: json['sdp'] as Map<String, dynamic>?,
        candidate: json['candidate'] as Map<String, dynamic>?,
        existingPeers: (json['existing_peers'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        errorMessage: json['message'] as String?,
      );

      _logger.signaling('Received signaling event: "$type" from server');
      _eventController.add(event);
    } catch (e) {
      _logger.warn('Failed to parse incoming signaling JSON: $rawJson');
    }
  }

  void _sendJson(Map<String, dynamic> data) {
    if (isConnected) {
      _socket!.add(jsonEncode(data));
    }
  }

  Future<void> disconnect() async {
    try {
      await _socket?.close();
    } catch (_) {}
    _socket = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _eventController.close();
  }
}
