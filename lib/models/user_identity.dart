/// Model representing local user's identity stored in SQLite.
class UserIdentity {
  final String id;
  final String displayName;
  final String publicKey;
  final String fingerprint;
  final String avatarUrl;
  final DateTime createdAt;

  const UserIdentity({
    required this.id,
    required this.displayName,
    required this.publicKey,
    required this.fingerprint,
    required this.avatarUrl,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'display_name': displayName,
        'public_key': publicKey,
        'fingerprint': fingerprint,
        'avatar_url': avatarUrl,
        'created_at': createdAt.toIso8601String(),
      };

  factory UserIdentity.fromMap(Map<String, dynamic> map) => UserIdentity(
        id: map['id'] as String,
        displayName: map['display_name'] as String,
        publicKey: map['public_key'] as String,
        fingerprint: map['fingerprint'] as String,
        avatarUrl: map['avatar_url'] as String,
        createdAt: DateTime.parse(map['created_at'] as String),
      );
}
