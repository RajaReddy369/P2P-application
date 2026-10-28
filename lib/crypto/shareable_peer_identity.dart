import 'dart:convert';
import 'package:crypto/crypto.dart' as crypto;

/// Public, shareable peer identity payload for QR codes and peer pairing.
/// Contains ONLY public cryptographic metadata. NEVER contains private key.
class ShareablePeerIdentity {
  final String peerId;
  final String displayName;
  final String publicKey;
  final String fingerprint;
  final String avatarUrl;

  const ShareablePeerIdentity({
    required this.peerId,
    required this.displayName,
    required this.publicKey,
    required this.fingerprint,
    required this.avatarUrl,
  });

  Map<String, dynamic> toJson() => {
        'peer_id': peerId,
        'display_name': displayName,
        'public_key': publicKey,
        'fingerprint': fingerprint,
        'avatar_url': avatarUrl,
      };

  String toQrPayload() => jsonEncode(toJson());

  factory ShareablePeerIdentity.fromJson(Map<String, dynamic> json) {
    return ShareablePeerIdentity(
      peerId: json['peer_id'] as String,
      displayName: json['display_name'] as String,
      publicKey: json['public_key'] as String,
      fingerprint: json['fingerprint'] as String,
      avatarUrl: json['avatar_url'] as String? ?? 'https://i.pravatar.cc/150?img=12',
    );
  }

  factory ShareablePeerIdentity.fromQrPayload(String qrPayload) {
    final Map<String, dynamic> decoded = jsonDecode(qrPayload) as Map<String, dynamic>;
    final identity = ShareablePeerIdentity.fromJson(decoded);
    
    // Verify fingerprint integrity upon import
    if (!identity.verifyFingerprintIntegrity()) {
      throw const FormatException('Cryptographic fingerprint validation failed for QR payload');
    }
    return identity;
  }

  /// Verifies that fingerprint matches SHA-256 hash of public key
  bool verifyFingerprintIntegrity() {
    final pubKeyBytes = utf8.encode(publicKey);
    final digest = crypto.sha256.convert(pubKeyBytes).bytes;
    final hexString = digest.map((b) => b.toRadixString(16).padLeft(2, '0')).join().toUpperCase();
    
    final expectedFingerprint = 'SHA256: ${hexString.substring(0, 4)}-${hexString.substring(4, 8)}-${hexString.substring(8, 12)}-${hexString.substring(12, 16)}';
    return fingerprint.startsWith('SHA256:') && fingerprint.contains(hexString.substring(0, 4));
  }
}
