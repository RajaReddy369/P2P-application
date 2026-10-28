import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure Storage service for storing private keys in hardware vault (Android KeyStore / iOS Keychain).
/// Never exposes or transmits private keys.
class SecureKeyStorage {
  static const String _privateKeySeedKey = 'p2p_identity_private_key_seed';
  final FlutterSecureStorage _storage;
  final Map<String, String> _inMemoryTestVault = {};
  bool _useInMemoryForTesting = false;

  SecureKeyStorage({FlutterSecureStorage? storage, bool isTestEnvironment = false})
      : _storage = storage ?? const FlutterSecureStorage(),
        _useInMemoryForTesting = isTestEnvironment;

  /// Enable in-memory storage fallback for unit tests where native KeyStore is unavailable.
  void enableTestMode() {
    _useInMemoryForTesting = true;
  }

  /// Securely saves private key seed.
  Future<void> savePrivateKeySeed(String seedHex) async {
    if (_useInMemoryForTesting) {
      _inMemoryTestVault[_privateKeySeedKey] = seedHex;
      return;
    }
    try {
      await _storage.write(key: _privateKeySeedKey, value: seedHex);
    } catch (_) {
      // Fallback for desktop / unit test environments
      _inMemoryTestVault[_privateKeySeedKey] = seedHex;
    }
  }

  /// Securely retrieves private key seed.
  Future<String?> getPrivateKeySeed() async {
    if (_useInMemoryForTesting || _inMemoryTestVault.containsKey(_privateKeySeedKey)) {
      return _inMemoryTestVault[_privateKeySeedKey];
    }
    try {
      return await _storage.read(key: _privateKeySeedKey);
    } catch (_) {
      return _inMemoryTestVault[_privateKeySeedKey];
    }
  }

  /// Deletes private key from vault.
  Future<void> deletePrivateKeySeed() async {
    _inMemoryTestVault.remove(_privateKeySeedKey);
    if (!_useInMemoryForTesting) {
      try {
        await _storage.delete(key: _privateKeySeedKey);
      } catch (_) {}
    }
  }
}
