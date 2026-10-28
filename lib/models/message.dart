import 'chat_message.dart';

/// Model representing an individual message in local SQLite storage.
class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String recipientId;
  final String content;
  final MessageType type;
  final MessageStatus status;
  final DateTime timestamp;
  final String? fileName;
  final int? fileSize;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.recipientId,
    required this.content,
    this.type = MessageType.text,
    this.status = MessageStatus.sent,
    required this.timestamp,
    this.fileName,
    this.fileSize,
  });

  bool isSentByMe(String myPeerId) => senderId == myPeerId;

  ChatMessage toChatMessage() => ChatMessage(
        id: id,
        senderId: senderId,
        recipientId: recipientId,
        content: content,
        type: type,
        status: status,
        timestamp: timestamp,
        fileName: fileName,
        fileSize: fileSize,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'conversation_id': conversationId,
        'sender_id': senderId,
        'recipient_id': recipientId,
        'content': content,
        'type': type.name,
        'status': status.name,
        'timestamp': timestamp.toIso8601String(),
        'file_name': fileName,
        'file_size': fileSize,
      };

  factory Message.fromMap(Map<String, dynamic> map) => Message(
        id: map['id'] as String,
        conversationId: map['conversation_id'] as String,
        senderId: map['sender_id'] as String,
        recipientId: map['recipient_id'] as String,
        content: map['content'] as String,
        type: MessageType.values.byName(map['type'] as String? ?? 'text'),
        status: MessageStatus.values.byName(map['status'] as String? ?? 'sent'),
        timestamp: DateTime.parse(map['timestamp'] as String),
        fileName: map['file_name'] as String?,
        fileSize: map['file_size'] as int?,
      );

  Message copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    String? recipientId,
    String? content,
    MessageType? type,
    MessageStatus? status,
    DateTime? timestamp,
    String? fileName,
    int? fileSize,
  }) {
    return Message(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      recipientId: recipientId ?? this.recipientId,
      content: content ?? this.content,
      type: type ?? this.type,
      status: status ?? this.status,
      timestamp: timestamp ?? this.timestamp,
      fileName: fileName ?? this.fileName,
      fileSize: fileSize ?? this.fileSize,
    );
  }
}
