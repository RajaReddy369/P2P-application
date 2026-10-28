import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';

/// File Chunk metadata frame for P2P DataChannel transmission.
class FileChunkFrame {
  final String fileTransferId;
  final int chunkIndex;
  final int totalChunks;
  final Uint8List payload;
  final String chunkHash;

  FileChunkFrame({
    required this.fileTransferId,
    required this.chunkIndex,
    required this.totalChunks,
    required this.payload,
    required this.chunkHash,
  });

  Map<String, dynamic> toJson() => {
        'file_transfer_id': fileTransferId,
        'chunk_index': chunkIndex,
        'total_chunks': totalChunks,
        'payload': base64Encode(payload),
        'chunk_hash': chunkHash,
      };

  factory FileChunkFrame.fromJson(Map<String, dynamic> json) => FileChunkFrame(
        fileTransferId: json['file_transfer_id'] as String,
        chunkIndex: json['chunk_index'] as int,
        totalChunks: json['total_chunks'] as int,
        payload: base64Decode(json['payload'] as String),
        chunkHash: json['chunk_hash'] as String,
      );

  String toRawJson() => jsonEncode(toJson());
  factory FileChunkFrame.fromRawJson(String str) => FileChunkFrame.fromJson(jsonDecode(str));
}

/// Service handling chunking, assembly, checksum verification, and resumption for P2P file transfers.
class FileChunkerService {
  static const int defaultChunkSize = 16 * 1024; // 16 KB

  /// Splits raw byte array into sequenced 16KB chunk frames.
  static List<FileChunkFrame> chunkFileBytes({
    required String fileTransferId,
    required Uint8List fileBytes,
    int chunkSize = defaultChunkSize,
  }) {
    final List<FileChunkFrame> frames = [];
    final int totalChunks = (fileBytes.length / chunkSize).ceil();

    for (int i = 0; i < totalChunks; i++) {
      final int start = i * chunkSize;
      final int end = (start + chunkSize < fileBytes.length) ? start + chunkSize : fileBytes.length;
      final Uint8List chunkData = fileBytes.sublist(start, end);

      final String hash = sha256.convert(chunkData).toString();

      frames.add(FileChunkFrame(
        fileTransferId: fileTransferId,
        chunkIndex: i,
        totalChunks: totalChunks,
        payload: chunkData,
        chunkHash: hash,
      ));
    }

    return frames;
  }

  /// Reassembles sequenced frames into complete file byte array after verifying checksums.
  static Uint8List reassembleChunks(List<FileChunkFrame> frames) {
    frames.sort((a, b) => a.chunkIndex.compareTo(b.chunkIndex));

    final BytesBuilder builder = BytesBuilder();
    for (final frame in frames) {
      final String calculatedHash = sha256.convert(frame.payload).toString();
      if (calculatedHash != frame.chunkHash) {
        throw StateError('Checksum mismatch at chunk index ${frame.chunkIndex}');
      }
      builder.add(frame.payload);
    }

    return builder.takeBytes();
  }

  /// Computes missing chunk indices for resumption ACK requests.
  static List<int> getMissingChunkIndices(int totalChunks, Set<int> receivedIndices) {
    final List<int> missing = [];
    for (int i = 0; i < totalChunks; i++) {
      if (!receivedIndices.contains(i)) {
        missing.add(i);
      }
    }
    return missing;
  }
}
