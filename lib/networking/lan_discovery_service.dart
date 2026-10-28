import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'lan_telemetry_model.dart';
import 'p2p_logger.dart';

/// Service managing UDP peer discovery on local Wi-Fi LAN subnet (Phase 4).
/// Logs all discovery events adhering to Rule 14 & Rule 19.
class LanDiscoveryService {
  final P2PLogger _logger = P2PLogger('LAN-Discovery');
  final int udpPort;
  final int tcpPort;

  RawDatagramSocket? _socket;
  Timer? _beaconTimer;
  String? _localPeerId;
  String? _displayName;
  String _localIp = '127.0.0.1';

  final Map<String, DiscoveredPeer> _peersMap = {};
  final StreamController<List<DiscoveredPeer>> _peersController =
      StreamController<List<DiscoveredPeer>>.broadcast();

  LanDiscoveryService({this.udpPort = 45454, this.tcpPort = 45455});

  Stream<List<DiscoveredPeer>> get discoveredPeersStream => _peersController.stream;
  List<DiscoveredPeer> get currentDiscoveredPeers => _peersMap.values.toList();
  String get localIp => _localIp;

  /// Starts UDP discovery broadcast & listener.
  Future<void> startDiscovery(String localPeerId, String displayName) async {
    _localPeerId = localPeerId;
    _displayName = displayName;
    _localIp = await _findLocalIpAddress();

    _logger.p2pNetwork('Starting LAN peer discovery on UDP port $udpPort (Local IP: $_localIp)');

    try {
      _socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, udpPort);
      _socket!.broadcastEnabled = true;

      _socket!.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          final datagram = _socket!.receive();
          if (datagram != null) {
            _handleIncomingDatagram(datagram);
          }
        }
      });

      // Periodically broadcast LAN discovery beacon
      _beaconTimer?.cancel();
      _beaconTimer = Timer.periodic(const Duration(seconds: 3), (_) => _sendBeacon());
      _sendBeacon(); // Initial beacon
    } catch (e, st) {
      _logger.error('Failed to bind UDP discovery socket on port $udpPort', e, st);
    }
  }

  /// Broadcasts UDP discovery packet on LAN.
  void _sendBeacon() {
    if (_socket == null || _localPeerId == null) return;

    final beacon = {
      'type': 'p2p_lan_beacon',
      'peer_id': _localPeerId,
      'display_name': _displayName ?? 'Unknown Node',
      'tcp_port': tcpPort,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    final payload = jsonEncode(beacon);
    final bytes = utf8.encode(payload);

    try {
      _socket!.send(bytes, InternetAddress('255.255.255.255'), udpPort);
      _logger.debug('Sent UDP broadcast beacon to 255.255.255.255:$udpPort');
    } catch (e) {
      _logger.warn('UDP broadcast send failed: $e');
    }
  }

  /// Parses incoming datagram and updates discovered peers map.
  void _handleIncomingDatagram(Datagram datagram) {
    try {
      final senderIp = datagram.address.address;
      final payload = utf8.decode(datagram.data);
      final json = jsonDecode(payload) as Map<String, dynamic>;

      if (json['type'] != 'p2p_lan_beacon') return;

      final peerId = json['peer_id'] as String;
      // Ignore self-beacons
      if (peerId == _localPeerId) return;

      final displayName = json['display_name'] as String;
      final peerTcpPort = json['tcp_port'] as int? ?? tcpPort;

      final peer = DiscoveredPeer(
        peerId: peerId,
        displayName: displayName,
        ipAddress: senderIp,
        tcpPort: peerTcpPort,
        lastSeen: DateTime.now(),
      );

      final isNew = !_peersMap.containsKey(peerId);
      _peersMap[peerId] = peer;
      _peersController.add(_peersMap.values.toList());

      if (isNew) {
        _logger.p2pNetwork('Discovered new LAN peer: "$displayName" ($peerId) at $senderIp:$peerTcpPort');
      }
    } catch (_) {}
  }

  /// Finds local network IPv4 address (Wi-Fi or Ethernet).
  static Future<String> _findLocalIpAddress() async {
    try {
      final interfaces = await NetworkInterface.list(
        type: InternetAddressType.IPv4,
        includeLoopback: false,
      );
      for (final interface in interfaces) {
        for (final addr in interface.addresses) {
          if (!addr.isLoopback && addr.type == InternetAddressType.IPv4) {
            return addr.address;
          }
        }
      }
    } catch (_) {}
    return '127.0.0.1';
  }

  /// Stops discovery services and frees socket.
  Future<void> stopDiscovery() async {
    _beaconTimer?.cancel();
    _socket?.close();
    _socket = null;
    _logger.info('LAN discovery service stopped');
  }
}
