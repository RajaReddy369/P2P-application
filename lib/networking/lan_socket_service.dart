import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../database/local_database_service.dart';
import '../models/connection_state_model.dart';
import '../models/network_status.dart';
import 'lan_telemetry_model.dart';
import 'p2p_logger.dart';

/// Service managing direct TCP Socket P2P connection, message exchange,
/// and live telemetry metrics (bytes sent, bytes received, latency RTT).
class LanSocketService {
  final P2PLogger _logger = P2PLogger('LAN-Socket');
  final LocalDatabaseService _dbService = LocalDatabaseService();
  final int tcpPort;

  ServerSocket? _serverSocket;
  Socket? _activeSocket;
  String? _localPeerId;
  DiscoveredPeer? _connectedPeer;

  int _bytesSent = 0;
  int _bytesReceived = 0;
  double _latencyMs = 0.0;
  LanConnectionStatus _status = LanConnectionStatus.disconnected;

  final List<String> _receivedMessages = [];
  final StreamController<LanTelemetryState> _telemetryController =
      StreamController<LanTelemetryState>.broadcast();

  LanSocketService({this.tcpPort = 45455});

  Stream<LanTelemetryState> get telemetryStream => _telemetryController.stream;
  LanConnectionStatus get status => _status;
  int get bytesSent => _bytesSent;
  int get bytesReceived => _bytesReceived;
  double get latencyMs => _latencyMs;
  List<String> get receivedMessages => List.unmodifiable(_receivedMessages);

  /// Starts TCP server listening for incoming direct P2P socket connections.
  Future<void> startServer(String localPeerId) async {
    _localPeerId = localPeerId;
    try {
      _serverSocket = await ServerSocket.bind(InternetAddress.anyIPv4, tcpPort);
      _logger.p2pNetwork('Direct P2P TCP Server listening on port $tcpPort');

      _serverSocket!.listen((Socket clientSocket) {
        _logger.p2pNetwork('Accepted incoming P2P TCP connection from ${clientSocket.remoteAddress.address}:${clientSocket.remotePort}');
        _handleIncomingSocketConnection(clientSocket);
      });
    } catch (e, st) {
      _logger.error('Failed to bind TCP ServerSocket on port $tcpPort', e, st);
    }
  }

  /// Connects directly to a remote LAN peer's IP address and port over TCP.
  Future<bool> connectToPeer(DiscoveredPeer peer) async {
    if (_localPeerId == null) return false;

    _status = LanConnectionStatus.connecting;
    _connectedPeer = peer;
    _notifyState();

    _logger.p2pNetwork('Establishing direct TCP connection to ${peer.displayName} at ${peer.ipAddress}:${peer.tcpPort}');

    try {
      final socket = await Socket.connect(
        peer.ipAddress,
        peer.tcpPort,
        timeout: const Duration(seconds: 5),
      );

      _setupSocket(socket, peer);
      _sendHandshake();
      _measureLatencyPing();

      _status = LanConnectionStatus.connected;
      _logger.p2pNetwork('Successfully connected direct P2P TCP socket to ${peer.peerId}!');
      _notifyState();
      _persistConnectionState(P2PState.directP2P);
      return true;
    } catch (e, st) {
      _status = LanConnectionStatus.failed;
      _logger.error('Direct TCP connection to ${peer.ipAddress}:${peer.tcpPort} failed', e, st);
      _notifyState();
      _persistConnectionState(P2PState.disconnected);
      return false;
    }
  }

  /// Handles incoming socket accepted by TCP server.
  void _handleIncomingSocketConnection(Socket socket) {
    final remoteIp = socket.remoteAddress.address;
    final tempPeer = DiscoveredPeer(
      peerId: 'remote_peer_${remoteIp.replaceAll('.', '_')}',
      displayName: 'Remote Peer ($remoteIp)',
      ipAddress: remoteIp,
      tcpPort: socket.remotePort,
      lastSeen: DateTime.now(),
    );

    _connectedPeer = tempPeer;
    _setupSocket(socket, tempPeer);
    _sendHandshake();

    _status = LanConnectionStatus.connected;
    _logger.p2pNetwork('Incoming direct P2P socket established with $remoteIp');
    _notifyState();
    _persistConnectionState(P2PState.directP2P);
  }

  /// Binds listeners to an active socket connection.
  void _setupSocket(Socket socket, DiscoveredPeer peer) {
    _activeSocket?.close();
    _activeSocket = socket;

    socket.listen(
      (List<int> data) {
        _bytesReceived += data.length;
        _parseIncomingPacket(data);
      },
      onError: (error) {
        _logger.error('P2P Socket error', error);
        disconnect();
      },
      onDone: () {
        _logger.p2pNetwork('P2P Socket connection closed by remote peer');
        disconnect();
      },
    );
  }

  /// Sends a direct P2P test message over the open TCP socket.
  Future<bool> sendTestMessage(String text) async {
    if (_activeSocket == null || _status != LanConnectionStatus.connected) {
      _logger.warn('Cannot send P2P message: socket is not connected');
      return false;
    }

    final packet = {
      'type': 'p2p_test_message',
      'sender_id': _localPeerId,
      'content': text,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    final jsonStr = jsonEncode(packet);
    final bytes = utf8.encode('$jsonStr\n');

    try {
      _activeSocket!.add(bytes);
      await _activeSocket!.flush();
      _bytesSent += bytes.length;

      _logger.p2pNetwork('Sent P2P test message to ${_connectedPeer?.peerId} (bytes: ${bytes.length})');
      _notifyState();
      return true;
    } catch (e, st) {
      _logger.error('Failed to send P2P test message', e, st);
      return false;
    }
  }

  /// Sends handshake packet upon connection.
  void _sendHandshake() {
    if (_activeSocket == null) return;
    final packet = {
      'type': 'p2p_handshake',
      'sender_id': _localPeerId,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    final bytes = utf8.encode('${jsonEncode(packet)}\n');
    _activeSocket!.add(bytes);
    _bytesSent += bytes.length;
  }

  /// Sends ping packet to measure latency (RTT ms).
  void _measureLatencyPing() {
    if (_activeSocket == null) return;
    final startTime = DateTime.now().millisecondsSinceEpoch;
    final packet = {
      'type': 'p2p_ping',
      'sent_time': startTime,
    };
    final bytes = utf8.encode('${jsonEncode(packet)}\n');
    _activeSocket!.add(bytes);
    _bytesSent += bytes.length;
  }

  /// Parses incoming packet lines.
  void _parseIncomingPacket(List<int> rawBytes) {
    try {
      final payload = utf8.decode(rawBytes);
      final lines = payload.split('\n');

      for (final line in lines) {
        if (line.trim().isEmpty) continue;
        final json = jsonDecode(line.trim()) as Map<String, dynamic>;
        final type = json['type'] as String?;

        if (type == 'p2p_test_message') {
          final content = json['content'] as String? ?? '';
          final sender = json['sender_id'] as String? ?? 'Peer';
          _receivedMessages.add('[$sender]: $content');
          _logger.p2pNetwork('Received P2P test message from $sender: "$content"');
          _notifyState();
        } else if (type == 'p2p_ping') {
          final sentTime = json['sent_time'] as int?;
          if (sentTime != null) {
            final pong = {'type': 'p2p_pong', 'sent_time': sentTime};
            final bytes = utf8.encode('${jsonEncode(pong)}\n');
            _activeSocket?.add(bytes);
            _bytesSent += bytes.length;
          }
        } else if (type == 'p2p_pong') {
          final sentTime = json['sent_time'] as int?;
          if (sentTime != null) {
            final now = DateTime.now().millisecondsSinceEpoch;
            _latencyMs = (now - sentTime).toDouble();
            _logger.p2pNetwork('Measured LAN Round-Trip Time (RTT): ${_latencyMs.toStringAsFixed(1)} ms');
            _notifyState();
          }
        }
      }
    } catch (_) {}
  }

  /// Closes connection and updates state.
  void disconnect() {
    _activeSocket?.close();
    _activeSocket = null;
    _status = LanConnectionStatus.disconnected;
    _connectedPeer = null;
    _logger.p2pNetwork('Direct P2P TCP socket disconnected');
    _notifyState();
    _persistConnectionState(P2PState.disconnected);
  }

  /// Persists connection state to local SQLite database.
  Future<void> _persistConnectionState(P2PState state) async {
    if (_connectedPeer == null) return;
    await _dbService.updateConnectionState(ConnectionStateModel(
      peerId: _connectedPeer!.peerId,
      state: state,
      rttMs: _latencyMs,
      transportType: 'Direct Wi-Fi LAN TCP Socket',
      lastUpdated: DateTime.now(),
    ));
  }

  void _notifyState() {
    _telemetryController.add(LanTelemetryState(
      localIp: '127.0.0.1',
      localPeerId: _localPeerId ?? 'local_node',
      status: _status,
      connectedPeer: _connectedPeer,
      bytesSent: _bytesSent,
      bytesReceived: _bytesReceived,
      latencyMs: _latencyMs,
      receivedMessages: List.unmodifiable(_receivedMessages),
    ));
  }

  Future<void> dispose() async {
    disconnect();
    await _serverSocket?.close();
    await _telemetryController.close();
  }
}
