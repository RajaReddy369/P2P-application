enum LanConnectionStatus { disconnected, discovering, connecting, connected, failed }

/// Model representing a peer discovered on the local Wi-Fi network.
class DiscoveredPeer {
  final String peerId;
  final String displayName;
  final String ipAddress;
  final int tcpPort;
  final DateTime lastSeen;

  const DiscoveredPeer({
    required this.peerId,
    required this.displayName,
    required this.ipAddress,
    required this.tcpPort,
    required this.lastSeen,
  });

  Map<String, dynamic> toJson() => {
        'peer_id': peerId,
        'display_name': displayName,
        'ip_address': ipAddress,
        'tcp_port': tcpPort,
        'last_seen': lastSeen.toIso8601String(),
      };

  factory DiscoveredPeer.fromJson(Map<String, dynamic> json) => DiscoveredPeer(
        peerId: json['peer_id'] as String,
        displayName: json['display_name'] as String,
        ipAddress: json['ip_address'] as String,
        tcpPort: json['tcp_port'] as int,
        lastSeen: DateTime.parse(json['last_seen'] as String),
      );
}

/// Telemetry state snapshot for Local Network P2P Communication.
class LanTelemetryState {
  final String localIp;
  final String localPeerId;
  final LanConnectionStatus status;
  final DiscoveredPeer? connectedPeer;
  final int bytesSent;
  final int bytesReceived;
  final double latencyMs;
  final List<DiscoveredPeer> discoveredPeers;
  final List<String> receivedMessages;

  const LanTelemetryState({
    required this.localIp,
    required this.localPeerId,
    this.status = LanConnectionStatus.disconnected,
    this.connectedPeer,
    this.bytesSent = 0,
    this.bytesReceived = 0,
    this.latencyMs = 0.0,
    this.discoveredPeers = const [],
    this.receivedMessages = const [],
  });

  LanTelemetryState copyWith({
    String? localIp,
    String? localPeerId,
    LanConnectionStatus? status,
    DiscoveredPeer? connectedPeer,
    int? bytesSent,
    int? bytesReceived,
    double? latencyMs,
    List<DiscoveredPeer>? discoveredPeers,
    List<String>? receivedMessages,
  }) {
    return LanTelemetryState(
      localIp: localIp ?? this.localIp,
      localPeerId: localPeerId ?? this.localPeerId,
      status: status ?? this.status,
      connectedPeer: connectedPeer ?? this.connectedPeer,
      bytesSent: bytesSent ?? this.bytesSent,
      bytesReceived: bytesReceived ?? this.bytesReceived,
      latencyMs: latencyMs ?? this.latencyMs,
      discoveredPeers: discoveredPeers ?? this.discoveredPeers,
      receivedMessages: receivedMessages ?? this.receivedMessages,
    );
  }
}
