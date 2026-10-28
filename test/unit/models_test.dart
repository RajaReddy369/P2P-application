import 'package:flutter_test/flutter_test.dart';
import 'package:p2p_messenger/models/chat_message.dart';
import 'package:p2p_messenger/models/network_status.dart';
import 'package:p2p_messenger/models/peer_identity.dart';

void main() {
  group('P2P Messenger Models Tests', () {
    test('PeerIdentity serialization and deserialization', () {
      final identity = PeerIdentity(
        id: 'peer_123',
        displayName: 'Test Peer',
        publicKey: 'pubkey_abc',
        fingerprint: 'SHA256: FINGERPRINT_123',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: DateTime(2026, 1, 1),
      );

      final json = identity.toJson();
      expect(json['id'], equals('peer_123'));
      expect(json['displayName'], equals('Test Peer'));

      final restored = PeerIdentity.fromJson(json);
      expect(restored.id, equals(identity.id));
      expect(restored.displayName, equals(identity.displayName));
      expect(restored.fingerprint, equals(identity.fingerprint));
    });

    test('ChatMessage properties and isSentByMe getter', () {
      final outgoingMsg = ChatMessage(
        id: 'msg_1',
        senderId: 'my_peer_id',
        recipientId: 'peer_bob',
        content: 'Hello World',
        timestamp: DateTime.now(),
      );

      final incomingMsg = ChatMessage(
        id: 'msg_2',
        senderId: 'peer_bob',
        recipientId: 'my_peer_id',
        content: 'Hi Alex',
        timestamp: DateTime.now(),
      );

      expect(outgoingMsg.isSentByMe, isTrue);
      expect(incomingMsg.isSentByMe, isFalse);
    });

    test('NetworkStatus initial state factory', () {
      final status = NetworkStatus.initial();
      expect(status.state, equals(P2PState.disconnected));
      expect(status.activeCandidatePair, equals('None'));
      expect(status.rttMs, equals(0.0));
      expect(status.activePeersCount, equals(0));
    });
  });
}
