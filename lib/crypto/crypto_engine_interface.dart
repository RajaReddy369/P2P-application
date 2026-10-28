import '../models/peer_identity.dart';

/// Abstract Crypto Engine Interface separating cryptographic logic from UI.
/// (Implemented in Phase 3: Peer Identity & Phase 9: Encrypted Messaging).
abstract class CryptoEngineInterface {
  Future<PeerIdentity> generateKeyPair(String displayName);
  Future<String> encryptPayload(String plaintext, String recipientPublicKey);
  Future<String> decryptPayload(String ciphertext, String senderPublicKey);
  Future<String> computeFingerprint(String publicKey);
}
