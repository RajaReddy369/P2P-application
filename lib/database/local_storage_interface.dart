import '../models/chat_message.dart';
import '../models/connection_state_model.dart';
import '../models/conversation.dart';
import '../models/message.dart';
import '../models/message_attachment.dart';
import '../models/peer.dart';
import '../models/transfer.dart';
import '../models/user_identity.dart';

/// Abstract Local Database Interface separating SQLite persistence logic from UI & Networking.
/// (Phase 2 Local SQLite Database Contract).
abstract class LocalStorageInterface {
  // Identity & Peer operations
  Future<void> saveUserIdentity(UserIdentity identity);
  Future<UserIdentity?> getUserIdentity();
  Future<void> savePeer(Peer peer);
  Future<List<Peer>> getPeers();

  // Conversation operations
  Future<void> createConversation(Conversation conversation, {Peer? peer});
  Future<Conversation?> retrieveConversation(String conversationId);
  Future<List<Conversation>> getConversations();
  Future<void> deleteConversation(String conversationId);

  // Message operations
  Future<void> saveMessage(Message message, {MessageAttachment? attachment});
  Future<List<Message>> getMessagesForConversation(String conversationId);
  Future<void> updateMessageStatus(String messageId, MessageStatus status);
  Future<List<Message>> searchMessages(String query);

  // Attachment & Transfer operations
  Future<void> saveAttachmentMetadata(MessageAttachment attachment);
  Future<MessageAttachment?> getAttachmentForMessage(String messageId);
  Future<void> saveTransfer(Transfer transfer);
  Future<Transfer?> getTransfer(String transferId);
  Future<void> updateTransferProgress(String transferId, int transferredBytes, TransferStatus status);

  // Telemetry & Connection State operations
  Future<void> updateConnectionState(ConnectionStateModel connectionState);
  Future<ConnectionStateModel?> getConnectionState(String peerId);
}
