import 'dart:developer' as developer;

enum LogLevel { debug, info, warn, error, networkP2p, signaling }

/// Structured Network & P2P Event Logger adhering to Rule 14.
class P2PLogger {
  final String tag;
  static bool enableConsoleOutput = true;
  static final List<String> _inMemoryLogs = [];

  P2PLogger(this.tag);

  void debug(String message) => _log(LogLevel.debug, message);
  void info(String message) => _log(LogLevel.info, message);
  void warn(String message) => _log(LogLevel.warn, message);
  void error(String message, [Object? error, StackTrace? stackTrace]) =>
      _log(LogLevel.error, message, error, stackTrace);
  void p2pNetwork(String message) => _log(LogLevel.networkP2p, message);
  void signaling(String message) => _log(LogLevel.signaling, message);

  void _log(LogLevel level, String message, [Object? err, StackTrace? st]) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 23);
    final prefix = _levelPrefix(level);
    final formattedLog = '[$timestamp] $prefix [$tag] $message';

    _inMemoryLogs.add(formattedLog);
    if (_inMemoryLogs.length > 500) {
      _inMemoryLogs.removeAt(0);
    }

    if (enableConsoleOutput) {
      developer.log(
        message,
        time: DateTime.now(),
        name: tag,
        error: err,
        stackTrace: st,
      );
    }
  }

  static String _levelPrefix(LogLevel level) {
    switch (level) {
      case LogLevel.debug:
        return '[DEBUG]';
      case LogLevel.info:
        return '[INFO] ';
      case LogLevel.warn:
        return '[WARN] ';
      case LogLevel.error:
        return '[ERROR]';
      case LogLevel.networkP2p:
        return '[P2P-NET]';
      case LogLevel.signaling:
        return '[SIGNAL]';
    }
  }

  static List<String> get recentLogs => List.unmodifiable(_inMemoryLogs);
  static void clearLogs() => _inMemoryLogs.clear();
}
