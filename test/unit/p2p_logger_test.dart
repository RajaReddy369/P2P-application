import 'package:flutter_test/flutter_test.dart';
import 'package:p2p_messenger/networking/p2p_logger.dart';

void main() {
  group('P2PLogger Unit Tests (Rule 14)', () {
    setUp(() {
      P2PLogger.clearLogs();
    });

    test('Log formatting and memory buffer retention', () {
      final logger = P2PLogger('TestComponent');
      P2PLogger.enableConsoleOutput = false;

      logger.info('Test info message');
      logger.p2pNetwork('Direct WebRTC DataChannel open');
      logger.signaling('SDP offer sent to peer');

      final logs = P2PLogger.recentLogs;
      expect(logs.length, equals(3));
      expect(logs[0], contains('[INFO]  [TestComponent] Test info message'));
      expect(logs[1], contains('[P2P-NET] [TestComponent] Direct WebRTC DataChannel open'));
      expect(logs[2], contains('[SIGNAL] [TestComponent] SDP offer sent to peer'));
    });
  });
}
