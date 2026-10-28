enum P2PState { disconnected, signaling, directP2P, turnRelay }

/// Model representing the live P2P network telemetry state.
class NetworkStatus {
  final P2PState state;
  final String activeCandidatePair;
  final double rttMs;
  final int activePeersCount;
  final String transportType;

  const NetworkStatus({
    required this.state,
    required this.activeCandidatePair,
    required this.rttMs,
    required this.activePeersCount,
    required this.transportType,
  });

  factory NetworkStatus.initial() {
    return const NetworkStatus(
      state: P2PState.disconnected,
      activeCandidatePair: 'None',
      rttMs: 0.0,
      activePeersCount: 0,
      transportType: 'Wi-Fi / Cellular LTE',
    );
  }
}
