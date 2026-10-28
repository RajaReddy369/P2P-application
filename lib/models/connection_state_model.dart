import 'network_status.dart';

/// Model representing a peer's connection state stored in SQLite database.
class ConnectionStateModel {
  final String peerId;
  final P2PState state;
  final String activeCandidatePair;
  final double rttMs;
  final String transportType;
  final DateTime lastUpdated;

  const ConnectionStateModel({
    required this.peerId,
    required this.state,
    this.activeCandidatePair = 'None',
    this.rttMs = 0.0,
    this.transportType = 'Direct Wi-Fi / LTE',
    required this.lastUpdated,
  });

  Map<String, dynamic> toMap() => {
        'peer_id': peerId,
        'state': state.name,
        'active_candidate_pair': activeCandidatePair,
        'rtt_ms': rttMs,
        'transport_type': transportType,
        'last_updated': lastUpdated.toIso8601String(),
      };

  factory ConnectionStateModel.fromMap(Map<String, dynamic> map) => ConnectionStateModel(
        peerId: map['peer_id'] as String,
        state: P2PState.values.byName(map['state'] as String? ?? 'disconnected'),
        activeCandidatePair: map['active_candidate_pair'] as String? ?? 'None',
        rttMs: (map['rtt_ms'] as num?)?.toDouble() ?? 0.0,
        transportType: map['transport_type'] as String? ?? 'Direct Wi-Fi / LTE',
        lastUpdated: DateTime.parse(map['last_updated'] as String),
      );
}
