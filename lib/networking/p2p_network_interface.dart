import '../models/network_status.dart';

/// Abstract Network Interface separating P2P networking logic from UI.
/// (Implemented in Phase 5: WebRTC DataChannel & Phase 6: Signaling).
abstract class P2PNetworkInterface {
  Future<void> initializeSignaling(String serverUri);
  Future<void> connectToPeer(String peerId);
  Future<void> disconnectFromPeer(String peerId);
  Future<void> sendDataChannelMessage(String peerId, String payload);
  Stream<NetworkStatus> get networkStatusStream;
}
