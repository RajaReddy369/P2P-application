/// Model representing attachment metadata associated with a local message.
class MessageAttachment {
  final String id;
  final String messageId;
  final String fileName;
  final String filePath;
  final int fileSize;
  final String mimeType;
  final String? checksum;
  final DateTime createdAt;

  const MessageAttachment({
    required this.id,
    required this.messageId,
    required this.fileName,
    required this.filePath,
    required this.fileSize,
    required this.mimeType,
    this.checksum,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'message_id': messageId,
        'file_name': fileName,
        'file_path': filePath,
        'file_size': fileSize,
        'mime_type': mimeType,
        'checksum': checksum,
        'created_at': createdAt.toIso8601String(),
      };

  factory MessageAttachment.fromMap(Map<String, dynamic> map) => MessageAttachment(
        id: map['id'] as String,
        messageId: map['message_id'] as String,
        fileName: map['file_name'] as String,
        filePath: map['file_path'] as String,
        fileSize: map['file_size'] as int,
        mimeType: map['mime_type'] as String,
        checksum: map['checksum'] as String?,
        createdAt: DateTime.parse(map['created_at'] as String),
      );
}
