/// Model representing a remote peer saved in local SQLite database.
class Peer {
  final String peerId;
  final String name;
  final String publicKey;
  final String fingerprint;
  final String avatarUrl;
  final bool isOnline;
  final String lastSeen;
  final DateTime createdAt;

  const Peer({
    required this.peerId,
    required this.name,
    this.publicKey = '',
    required this.fingerprint,
    required this.avatarUrl,
    required this.isOnline,
    required this.lastSeen,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'peer_id': peerId,
        'name': name,
        'public_key': publicKey,
        'fingerprint': fingerprint,
        'avatar_url': avatarUrl,
        'is_online': isOnline ? 1 : 0,
        'last_seen': lastSeen,
        'created_at': createdAt.toIso8601String(),
      };

  factory Peer.fromMap(Map<String, dynamic> map) => Peer(
        peerId: map['peer_id'] as String,
        name: map['name'] as String,
        publicKey: (map['public_key'] as String?) ?? '',
        fingerprint: map['fingerprint'] as String,
        avatarUrl: map['avatar_url'] as String,
        isOnline: (map['is_online'] as int) == 1,
        lastSeen: map['last_seen'] as String,
        createdAt: map['created_at'] != null
            ? DateTime.parse(map['created_at'] as String)
            : DateTime.now(),
      );
}
