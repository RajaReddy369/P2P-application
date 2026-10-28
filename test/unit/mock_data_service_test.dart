import 'package:flutter_test/flutter_test.dart';
import 'package:p2p_messenger/models/chat_message.dart';
import 'package:p2p_messenger/services/mock_data_service.dart';

void main() {
  group('MockDataService Unit Tests', () {
    test('myIdentity has valid default properties', () {
      final identity = MockDataService.myIdentity;
      expect(identity.id, equals('my_peer_id'));
      expect(identity.displayName, equals('Alex Rivers'));
      expect(identity.fingerprint, contains('SHA256:'));
    });

    test('mockContacts list is populated and non-empty', () {
      final contacts = MockDataService.mockContacts;
      expect(contacts, isNotEmpty);
      expect(contacts.length, greaterThanOrEqualTo(3));
      expect(contacts.any((c) => c.isOnline), isTrue);
    });

    test('mockConversations list is valid', () {
      final conversations = MockDataService.mockConversations;
      expect(conversations, isNotEmpty);
      expect(conversations.first.peer.name, isNotEmpty);
      expect(conversations.first.lastMessage.content, isNotEmpty);
    });

    test('getMockMessagesForPeer returns messages for a given peer', () {
      const peerId = 'peer_alice_98';
      final messages = MockDataService.getMockMessagesForPeer(peerId);
      expect(messages, isNotEmpty);
      expect(messages.any((m) => m.senderId == peerId), isTrue);
      expect(messages.any((m) => m.isSentByMe), isTrue);
    });
  });
}
