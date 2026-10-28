import 'chat_message.dart';
import 'contact_model.dart';

/// Model representing a chat conversation thread with a remote peer.
class ChatConversation {
  final String id;
  final ContactModel peer;
  final ChatMessage lastMessage;
  final int unreadCount;
  final bool isP2pConnected;

  const ChatConversation({
    required this.id,
    required this.peer,
    required this.lastMessage,
    this.unreadCount = 0,
    this.isP2pConnected = true,
  });
}
