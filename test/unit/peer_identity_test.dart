import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:p2p_messenger/crypto/crypto_engine_service.dart';
import 'package:p2p_messenger/crypto/peer_identity_service.dart';
import 'package:p2p_messenger/crypto/secure_key_storage.dart';
import 'package:p2p_messenger/crypto/shareable_peer_identity.dart';
import 'package:p2p_messenger/database/local_database_service.dart';

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late SecureKeyStorage secureStorage;
  late CryptoEngineService cryptoEngine;
  late LocalDatabaseService dbService;
  late PeerIdentityService identityService;
  late Database db;

  setUp(() async {
    secureStorage = SecureKeyStorage(isTestEnvironment: true);
    cryptoEngine = CryptoEngineService(secureStorage: secureStorage);

    db = await openDatabase(
      inMemoryDatabasePath,
      version: 1,
      onConfigure: (db) async => await db.execute('PRAGMA foreign_keys = ON;'),
      onCreate: (db, version) async {},
    );

    await db.execute('''
      CREATE TABLE user_identity (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        avatar_url TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    ''');
    await db.execute('''
      CREATE TABLE peers (
        peer_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        avatar_url TEXT NOT NULL,
        is_online INTEGER NOT NULL DEFAULT 0,
        last_seen TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    ''');

    dbService = LocalDatabaseService(database: db);
    identityService = PeerIdentityService(
      databaseService: dbService,
      cryptoEngineService: cryptoEngine,
      keyStorage: secureStorage,
    );
  });

  tearDown(() async {
    await db.close();
  });

  group('Phase 3 Cryptographic Peer Identity Unit Tests', () {
    test('1. Generate Ed25519 keypair and derive stable peer identifier', () async {
      final identity = await cryptoEngine.generateUserIdentity('Alice Rivers');

      expect(identity.id, startsWith('peer_'));
      expect(identity.publicKey, isNotEmpty);
      expect(identity.publicKey.length, equals(64)); // 32 bytes hex encoded = 64 characters
      expect(identity.fingerprint, startsWith('SHA256:'));
      expect(identity.displayName, equals('Alice Rivers'));
    });

    test('2. Private key seed is stored securely and never transmitted', () async {
      final identity = await identityService.initializeOrLoadIdentity(displayName: 'Secure Test User');
      final privateSeedHex = await secureStorage.getPrivateKeySeed();

      expect(privateSeedHex, isNotNull);
      expect(privateSeedHex!.length, equals(64)); // 32-byte secret seed

      // Verify QR payload NEVER contains private key
      final qrPayload = await identityService.getShareableQrPayload();
      expect(qrPayload, contains(identity.id));
      expect(qrPayload, contains(identity.publicKey));
      expect(qrPayload, contains(identity.fingerprint));
      expect(qrPayload, isNot(contains(privateSeedHex)));
    });

    test('3. Store public identity in local SQLite database', () async {
      final createdIdentity = await identityService.initializeOrLoadIdentity(displayName: 'Database User');
      final retrievedIdentity = await dbService.getUserIdentity();

      expect(retrievedIdentity, isNotNull);
      expect(retrievedIdentity!.id, equals(createdIdentity.id));
      expect(retrievedIdentity.publicKey, equals(createdIdentity.publicKey));
      expect(retrievedIdentity.fingerprint, equals(createdIdentity.fingerprint));
    });

    test('4. Export ShareablePeerIdentity to QR Payload and deserialize', () {
      const shareable = ShareablePeerIdentity(
        peerId: 'peer_1234567890abcdef',
        displayName: 'Bob Builder',
        publicKey: '3059301306072a8648ce3d020106082a8648ce3d03010703420004e4b899f1',
        fingerprint: 'SHA256: E4B8-99F1-40A2-78CD',
        avatarUrl: 'https://example.com/bob.jpg',
      );

      final qrString = shareable.toQrPayload();
      expect(qrString, contains('"peer_id":"peer_1234567890abcdef"'));

      final parsed = ShareablePeerIdentity.fromQrPayload(qrString);
      expect(parsed.peerId, equals(shareable.peerId));
      expect(parsed.displayName, equals(shareable.displayName));
      expect(parsed.publicKey, equals(shareable.publicKey));
    });

    test('5. Import peer from QR payload into local SQLite database', () async {
      // 1. Peer generates their identity
      final peerEngine = CryptoEngineService(secureStorage: SecureKeyStorage(isTestEnvironment: true));
      final peerIdentity = await peerEngine.generateUserIdentity('Remote Peer Charlie');

      final shareablePeer = ShareablePeerIdentity(
        peerId: peerIdentity.id,
        displayName: peerIdentity.displayName,
        publicKey: peerIdentity.publicKey,
        fingerprint: peerIdentity.fingerprint,
        avatarUrl: peerIdentity.avatarUrl,
      );

      final qrPayload = shareablePeer.toQrPayload();

      // 2. Local node imports Charlie via QR payload string
      final importedPeer = await identityService.importPeerFromQrPayload(qrPayload);

      expect(importedPeer.peerId, equals(peerIdentity.id));
      expect(importedPeer.name, equals('Remote Peer Charlie'));
      expect(importedPeer.fingerprint, equals(peerIdentity.fingerprint));

      // 3. Verify peer is persisted in SQLite
      final dbPeers = await dbService.getPeers();
      expect(dbPeers.any((p) => p.peerId == peerIdentity.id), isTrue);
    });
  });
}
