enum TransferStatus { pending, inProgress, completed, failed, cancelled }

/// Model representing a P2P file transfer session in SQLite database.
class Transfer {
  final String id;
  final String messageId;
  final String fileName;
  final int totalBytes;
  final int transferredBytes;
  final TransferStatus status;
  final DateTime startedAt;
  final DateTime? completedAt;

  const Transfer({
    required this.id,
    required this.messageId,
    required this.fileName,
    required this.totalBytes,
    this.transferredBytes = 0,
    this.status = TransferStatus.pending,
    required this.startedAt,
    this.completedAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'message_id': messageId,
        'file_name': fileName,
        'total_bytes': totalBytes,
        'transferred_bytes': transferredBytes,
        'status': status.name,
        'started_at': startedAt.toIso8601String(),
        'completed_at': completedAt?.toIso8601String(),
      };

  factory Transfer.fromMap(Map<String, dynamic> map) => Transfer(
        id: map['id'] as String,
        messageId: map['message_id'] as String,
        fileName: map['file_name'] as String,
        totalBytes: map['total_bytes'] as int,
        transferredBytes: map['transferred_bytes'] as int? ?? 0,
        status: TransferStatus.values.byName(map['status'] as String? ?? 'pending'),
        startedAt: DateTime.parse(map['started_at'] as String),
        completedAt: map['completed_at'] != null ? DateTime.parse(map['completed_at'] as String) : null,
      );

  Transfer copyWith({
    String? id,
    String? messageId,
    String? fileName,
    int? totalBytes,
    int? transferredBytes,
    TransferStatus? status,
    DateTime? startedAt,
    DateTime? completedAt,
  }) {
    return Transfer(
      id: id ?? this.id,
      messageId: messageId ?? this.messageId,
      fileName: fileName ?? this.fileName,
      totalBytes: totalBytes ?? this.totalBytes,
      transferredBytes: transferredBytes ?? this.transferredBytes,
      status: status ?? this.status,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}
