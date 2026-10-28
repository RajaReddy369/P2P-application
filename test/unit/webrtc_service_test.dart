import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';

import 'package:p2p_messenger/networking/p2p_logger.dart';
import 'package:p2p_messenger/networking/webrtc_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 5 WebRTC DataChannel Unit Tests', () {
    setUp(() {
      P2PLogger.clearLogs();
    });

    test('1. WebRtcService initial state and STUN configuration', () {
      final service = WebRtcService();

      expect(service.bytesSent, equals(0));
      expect(service.bytesReceived, equals(0));
      expect(service.localIceCandidates, isEmpty);
      expect(service.receivedMessages, isEmpty);
      expect(WebRtcService.defaultConfiguration['iceServers'], isNotEmpty);
    });

    test('2. WebRTC State Transition Logger Retention (Rule 14 & 19)', () {
      final logger = P2PLogger('WebRTC-Test');

      logger.p2pNetwork('[WebRTC Transition] Peer Connection State: connected');
      logger.p2pNetwork('[WebRTC Transition] DataChannel "p2p_data_channel" State: open');
      logger.p2pNetwork('[WebRTC Action] Created Local SDP Offer');

      final logs = P2PLogger.recentLogs;
      expect(logs.length, equals(3));
      expect(logs[0], contains('Peer Connection State: connected'));
      expect(logs[1], contains('DataChannel "p2p_data_channel" State: open'));
      expect(logs[2], contains('Created Local SDP Offer'));
    });

    test('3. WebRtcTelemetryState model copyWith and updates', () {
      const state = WebRtcTelemetryState(
        bytesSent: 1024,
        bytesReceived: 2048,
        receivedMessages: ['Test message 1'],
      );

      expect(state.bytesSent, equals(1024));
      expect(state.bytesReceived, equals(2048));
      expect(state.receivedMessages.first, equals('Test message 1'));

      final updated = state.copyWith(bytesSent: 4096);
      expect(updated.bytesSent, equals(4096));
      expect(updated.bytesReceived, equals(2048));
    });
  });
}
