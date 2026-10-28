/// Model representing a peer's cryptographic identity in the P2P network.
class PeerIdentity {
  final String id;
  final String displayName;
  final String publicKey;
  final String fingerprint;
  final String avatarUrl;
  final DateTime createdAt;

  const PeerIdentity({
    required this.id,
    required this.displayName,
    required this.publicKey,
    required this.fingerprint,
    required this.avatarUrl,
    required this.createdAt,
  });

  factory PeerIdentity.mock() {
    return PeerIdentity(
      id: 'peer_node_8f92a1',
      displayName: 'Alex Rivers',
      publicKey: '3059301306072a8648ce3d020106082a8648ce3d03010703420004e4b899f1',
      fingerprint: 'SHA256: E4B8-99F1-40A2-78CD-31E9-8802-11FA-0B22',
      avatarUrl: 'https://i.pravatar.cc/150?img=11',
      createdAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'displayName': displayName,
        'publicKey': publicKey,
        'fingerprint': fingerprint,
        'avatarUrl': avatarUrl,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PeerIdentity.fromJson(Map<String, dynamic> json) => PeerIdentity(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        publicKey: json['publicKey'] as String,
        fingerprint: json['fingerprint'] as String,
        avatarUrl: json['avatarUrl'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
