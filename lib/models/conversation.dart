import 'peer.dart';

/// Model representing a P2P conversation thread stored in local SQLite database.
class Conversation {
  final String id;
  final String peerId;
  final String? lastMessageId;
  final int unreadCount;
  final bool isP2pConnected;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Peer? peer;

  const Conversation({
    required this.id,
    required this.peerId,
    this.lastMessageId,
    this.unreadCount = 0,
    this.isP2pConnected = true,
    required this.createdAt,
    required this.updatedAt,
    this.peer,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'peer_id': peerId,
        'last_message_id': lastMessageId,
        'unread_count': unreadCount,
        'is_p2p_connected': isP2pConnected ? 1 : 0,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
      };

  factory Conversation.fromMap(Map<String, dynamic> map, {Peer? peer}) => Conversation(
        id: map['id'] as String,
        peerId: map['peer_id'] as String,
        lastMessageId: map['last_message_id'] as String?,
        unreadCount: map['unread_count'] as int? ?? 0,
        isP2pConnected: (map['is_p2p_connected'] as int? ?? 1) == 1,
        createdAt: DateTime.parse(map['created_at'] as String),
        updatedAt: DateTime.parse(map['updated_at'] as String),
        peer: peer,
      );

  Conversation copyWith({
    String? id,
    String? peerId,
    String? lastMessageId,
    int? unreadCount,
    bool? isP2pConnected,
    DateTime? createdAt,
    DateTime? updatedAt,
    Peer? peer,
  }) {
    return Conversation(
      id: id ?? this.id,
      peerId: peerId ?? this.peerId,
      lastMessageId: lastMessageId ?? this.lastMessageId,
      unreadCount: unreadCount ?? this.unreadCount,
      isP2pConnected: isP2pConnected ?? this.isP2pConnected,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      peer: peer ?? this.peer,
    );
  }
}
