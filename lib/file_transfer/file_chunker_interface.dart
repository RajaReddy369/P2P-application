import 'dart:typed_data';

/// Abstract File Transfer Interface separating file chunking/reassembly logic from UI.
/// (Implemented in Phase 10: Image/File Transfer).
abstract class FileChunkerInterface {
  Stream<Uint8List> chunkFile(String filePath, {int chunkSize = 64 * 1024});
  Future<String> reassembleChunks(List<Uint8List> chunks, String outputFileName);
  Future<String> computeFileChecksum(String filePath);
}
