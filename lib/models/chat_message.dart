enum MessageType { text, image, file, voice, video }
enum MessageStatus { sending, sent, delivered, read, failed }

/// Model representing an individual message in a P2P conversation.
class ChatMessage {
  final String id;
  final String senderId;
  final String recipientId;
  final String content;
  final MessageType type;
  final MessageStatus status;
  final DateTime timestamp;
  final String? fileName;
  final int? fileSize;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.content,
    this.type = MessageType.text,
    this.status = MessageStatus.delivered,
    required this.timestamp,
    this.fileName,
    this.fileSize,
  });

  bool get isSentByMe => senderId == 'my_peer_id';
}
