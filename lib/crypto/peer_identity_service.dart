import '../database/local_database_service.dart';
import '../models/peer.dart';
import '../models/user_identity.dart';
import 'crypto_engine_service.dart';
import 'secure_key_storage.dart';
import 'shareable_peer_identity.dart';

/// Coordinator service managing local peer identity bootstrap, secure vault persistence,
/// QR identity serialization, and peer import.
class PeerIdentityService {
  final LocalDatabaseService dbService;
  final CryptoEngineService cryptoEngine;
  final SecureKeyStorage secureStorage;

  PeerIdentityService({
    LocalDatabaseService? databaseService,
    CryptoEngineService? cryptoEngineService,
    SecureKeyStorage? keyStorage,
  })  : dbService = databaseService ?? LocalDatabaseService(),
        cryptoEngine = cryptoEngineService ?? CryptoEngineService(),
        secureStorage = keyStorage ?? SecureKeyStorage();

  /// Gets existing local user identity or generates a new Ed25519 identity keypair if first run.
  Future<UserIdentity> initializeOrLoadIdentity({String displayName = 'Alex Rivers'}) async {
    final existingIdentity = await dbService.getUserIdentity();
    final existingPrivateKey = await secureStorage.getPrivateKeySeed();

    if (existingIdentity != null && existingPrivateKey != null) {
      return existingIdentity;
    }

    // Generate fresh cryptographic Ed25519 identity keypair
    final newIdentity = await cryptoEngine.generateUserIdentity(displayName);
    await dbService.saveUserIdentity(newIdentity);
    return newIdentity;
  }

  /// Exports current local user identity into a public, shareable QR string.
  /// Never contains private key.
  Future<String> getShareableQrPayload() async {
    final identity = await initializeOrLoadIdentity();
    final shareable = ShareablePeerIdentity(
      peerId: identity.id,
      displayName: identity.displayName,
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      avatarUrl: identity.avatarUrl,
    );
    return shareable.toQrPayload();
  }

  /// Imports another remote peer from scanned QR data payload string.
  /// Validates cryptographic SHA-256 fingerprint and saves peer to local SQLite database.
  Future<Peer> importPeerFromQrPayload(String qrPayload) async {
    final shareable = ShareablePeerIdentity.fromQrPayload(qrPayload);

    final peer = Peer(
      peerId: shareable.peerId,
      name: shareable.displayName,
      publicKey: shareable.publicKey,
      fingerprint: shareable.fingerprint,
      avatarUrl: shareable.avatarUrl,
      isOnline: true,
      lastSeen: 'Just paired via QR',
      createdAt: DateTime.now(),
    );

    await dbService.savePeer(peer);
    return peer;
  }
}
