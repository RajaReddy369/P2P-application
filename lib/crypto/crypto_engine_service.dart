import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as crypto_pkg;
import 'package:cryptography/cryptography.dart';

import '../models/peer_identity.dart';
import '../models/user_identity.dart';
import 'crypto_engine_interface.dart';
import 'secure_key_storage.dart';

/// Concrete Cryptographic Engine Service using Ed25519, AES-256-GCM, & SHA-256 libraries.
/// Strictly separates cryptographic algorithms from UI.
/// Never exposes or transmits private keys.
class CryptoEngineService implements CryptoEngineInterface {
  final SecureKeyStorage secureKeyStorage;
  final Ed25519 _ed25519Algorithm;
  final AesGcm _aesGcm256;

  CryptoEngineService({
    SecureKeyStorage? secureStorage,
    Ed25519? ed25519,
    AesGcm? aesGcm,
  })  : secureKeyStorage = secureStorage ?? SecureKeyStorage(),
        _ed25519Algorithm = ed25519 ?? Ed25519(),
        _aesGcm256 = aesGcm ?? AesGcm.with256bits();

  /// Generates a new Ed25519 keypair when app is initialized.
  Future<UserIdentity> generateUserIdentity(String displayName) async {
    final keyPair = await _ed25519Algorithm.newKeyPair();
    final keyPairData = await keyPair.extract();
    final privateKeyBytes = keyPairData.bytes;

    final pubKey = await keyPair.extractPublicKey();
    final publicKeyBytes = (pubKey as SimplePublicKey).bytes;

    final publicKeyHex = _bytesToHex(publicKeyBytes);
    final privateSeedHex = _bytesToHex(privateKeyBytes);

    await secureKeyStorage.savePrivateKeySeed(privateSeedHex);

    final sha256Digest = crypto_pkg.sha256.convert(publicKeyBytes).bytes;
    final sha256Hex = _bytesToHex(sha256Digest).toUpperCase();

    final peerId = 'peer_${sha256Hex.substring(0, 16).toLowerCase()}';
    final fingerprint =
        'SHA256: ${sha256Hex.substring(0, 4)}-${sha256Hex.substring(4, 8)}-${sha256Hex.substring(8, 12)}-${sha256Hex.substring(12, 16)}';

    return UserIdentity(
      id: peerId,
      displayName: displayName,
      publicKey: publicKeyHex,
      fingerprint: fingerprint,
      avatarUrl: 'https://i.pravatar.cc/150?img=11',
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<PeerIdentity> generateKeyPair(String displayName) async {
    final userIdentity = await generateUserIdentity(displayName);
    return PeerIdentity(
      id: userIdentity.id,
      displayName: userIdentity.displayName,
      publicKey: userIdentity.publicKey,
      fingerprint: userIdentity.fingerprint,
      avatarUrl: userIdentity.avatarUrl,
      createdAt: userIdentity.createdAt,
    );
  }

  @override
  Future<String> computeFingerprint(String publicKeyHex) async {
    final pubKeyBytes = _hexToBytes(publicKeyHex);
    final sha256Digest = crypto_pkg.sha256.convert(pubKeyBytes).bytes;
    final sha256Hex = _bytesToHex(sha256Digest).toUpperCase();

    return 'SHA256: ${sha256Hex.substring(0, 4)}-${sha256Hex.substring(4, 8)}-${sha256Hex.substring(8, 12)}-${sha256Hex.substring(12, 16)}';
  }

  /// Encrypts plaintext string using AES-256-GCM with derived key.
  @override
  Future<String> encryptPayload(String plaintext, String recipientPublicKey) async {
    final secretKeyBytes = _deriveSymmetricKeyBytes(recipientPublicKey);
    final secretKey = SecretKey(secretKeyBytes);

    final plaintextBytes = utf8.encode(plaintext);
    final secretBox = await _aesGcm256.encrypt(
      plaintextBytes,
      secretKey: secretKey,
    );

    final combined = Uint8List.fromList([
      ...secretBox.nonce,
      ...secretBox.mac.bytes,
      ...secretBox.cipherText,
    ]);

    return base64Encode(combined);
  }

  /// Decrypts AES-256-GCM payload string.
  @override
  Future<String> decryptPayload(String ciphertext, String senderPublicKey) async {
    final combined = base64Decode(ciphertext);
    if (combined.length < 28) { // 12-byte IV + 16-byte MAC tag
      throw ArgumentError('Ciphertext too short for AES-GCM');
    }

    final nonce = combined.sublist(0, 12);
    final macBytes = combined.sublist(12, 28);
    final cipherText = combined.sublist(28);

    final secretKeyBytes = _deriveSymmetricKeyBytes(senderPublicKey);
    final secretKey = SecretKey(secretKeyBytes);

    final secretBox = SecretBox(
      cipherText,
      nonce: nonce,
      mac: Mac(macBytes),
    );

    final clearTextBytes = await _aesGcm256.decrypt(
      secretBox,
      secretKey: secretKey,
    );

    return utf8.decode(clearTextBytes);
  }

  List<int> _deriveSymmetricKeyBytes(String publicKeyHex) {
    final pubKeyBytes = _hexToBytes(publicKeyHex.padRight(64, '0').substring(0, 64));
    final digest = crypto_pkg.sha256.convert(pubKeyBytes);
    return digest.bytes;
  }

  static String _bytesToHex(List<int> bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static List<int> _hexToBytes(String hex) {
    final result = <int>[];
    for (int i = 0; i < hex.length; i += 2) {
      result.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return result;
  }
}
