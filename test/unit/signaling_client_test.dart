import 'package:flutter_test/flutter_test.dart';

import 'package:p2p_messenger/networking/p2p_logger.dart';
import 'package:p2p_messenger/networking/signaling_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 6 SignalingClient Unit Tests', () {
    setUp(() {
      P2PLogger.clearLogs();
    });

    test('1. SignalingEvent properties and constructor', () {
      const event = SignalingEvent(
        type: 'room_created',
        roomId: 'room_alpha',
        peerId: 'peer_123',
      );

      expect(event.type, equals('room_created'));
      expect(event.roomId, equals('room_alpha'));
      expect(event.peerId, equals('peer_123'));
    });

    test('2. SignalingClient initial state', () {
      final client = SignalingClient();

      expect(client.isConnected, isFalse);
      expect(client.eventStream, isNotNull);
    });

    test('3. Signaling Logger Logging (Rule 14 & 19)', () {
      final logger = P2PLogger('Signaling-Test');

      logger.signaling('Connecting to wss://signaling.p2p.internal');
      logger.signaling('Room "room_alpha" created by peer_123');
      logger.signaling('Relaying SDP offer to target peer_456');

      final logs = P2PLogger.recentLogs;
      expect(logs.length, equals(3));
      expect(logs[0], contains('[SIGNAL]'));
      expect(logs[1], contains('room_alpha'));
      expect(logs[2], contains('peer_456'));
    });
  });
}
