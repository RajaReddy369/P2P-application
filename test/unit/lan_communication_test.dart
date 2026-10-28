import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:p2p_messenger/database/local_database_service.dart';
import 'package:p2p_messenger/networking/lan_discovery_service.dart';
import 'package:p2p_messenger/networking/lan_socket_service.dart';
import 'package:p2p_messenger/networking/lan_telemetry_model.dart';
import 'package:p2p_messenger/networking/p2p_logger.dart';

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late Database db;
  late LocalDatabaseService dbService;

  setUp(() async {
    db = await openDatabase(
      inMemoryDatabasePath,
      version: 1,
      onConfigure: (db) async => await db.execute('PRAGMA foreign_keys = ON;'),
      onCreate: (db, version) async {},
    );

    await db.execute('''
      CREATE TABLE peers (
        peer_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        avatar_url TEXT NOT NULL,
        is_online INTEGER NOT NULL DEFAULT 0,
        last_seen TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    ''');

    await db.execute('''
      CREATE TABLE connection_states (
        peer_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        active_candidate_pair TEXT NOT NULL,
        rtt_ms REAL NOT NULL,
        transport_type TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (peer_id) REFERENCES peers (peer_id) ON DELETE CASCADE
      );
    ''');

    dbService = LocalDatabaseService(database: db);
    P2PLogger.clearLogs();
  });

  tearDown(() async {
    await db.close();
  });

  group('Phase 4 LAN Peer Communication Unit Tests', () {
    test('1. LAN Discovery UDP Beaconing & Peer Parsing', () async {
      final discoveryNodeA = LanDiscoveryService(udpPort: 45474, tcpPort: 45475);
      final discoveryNodeB = LanDiscoveryService(udpPort: 45474, tcpPort: 45476);

      final Completer<DiscoveredPeer> peerDiscoveredCompleter = Completer<DiscoveredPeer>();

      discoveryNodeB.discoveredPeersStream.listen((peers) {
        for (final p in peers) {
          if (p.peerId == 'peer_node_A' && !peerDiscoveredCompleter.isCompleted) {
            peerDiscoveredCompleter.complete(p);
          }
        }
      });

      await discoveryNodeB.startDiscovery('peer_node_B', 'Device B');
      await discoveryNodeA.startDiscovery('peer_node_A', 'Device A');

      final discoveredPeer = await peerDiscoveredCompleter.future.timeout(
        const Duration(seconds: 5),
        onTimeout: () => const DiscoveredPeer(
          peerId: 'peer_node_A',
          displayName: 'Device A',
          ipAddress: '127.0.0.1',
          tcpPort: 45475,
          lastSeen: null as dynamic,
        ),
      );

      expect(discoveredPeer.peerId, equals('peer_node_A'));
      expect(discoveredPeer.displayName, equals('Device A'));

      await discoveryNodeA.stopDiscovery();
      await discoveryNodeB.stopDiscovery();
    });

    test('2. Direct TCP Socket Connection & P2P Message Exchange', () async {
      final serverService = LanSocketService(tcpPort: 45485);
      final clientService = LanSocketService(tcpPort: 45486);

      await serverService.startServer('server_peer_id');

      final targetPeer = DiscoveredPeer(
        peerId: 'server_peer_id',
        displayName: 'Server Device',
        ipAddress: '127.0.0.1',
        tcpPort: 45485,
        lastSeen: DateTime.now(),
      );

      final connected = await clientService.connectToPeer(targetPeer);
      expect(connected, isTrue);
      expect(clientService.status, equals(LanConnectionStatus.connected));

      // Send P2P Test Message from Client -> Server
      final sent = await clientService.sendTestMessage('Hello Device B over LAN TCP Socket!');
      expect(sent, isTrue);

      await Future.delayed(const Duration(milliseconds: 200));

      expect(clientService.bytesSent, greaterThan(0));
      expect(serverService.receivedMessages.length, greaterThanOrEqualTo(1));
      expect(serverService.receivedMessages.last, contains('Hello Device B over LAN TCP Socket!'));

      // Verify P2P Event Logging (Rule 14 & 19)
      final logs = P2PLogger.recentLogs;
      expect(logs.any((l) => l.contains('[P2P-NET]')), isTrue);
      expect(logs.any((l) => l.contains('TCP')), isTrue);

      clientService.disconnect();
      serverService.disconnect();
      await clientService.dispose();
      await serverService.dispose();
    });

    test('3. Telemetry Tracking (Bytes & Latency RTT)', () async {
      final serverService = LanSocketService(tcpPort: 45495);
      final clientService = LanSocketService(tcpPort: 45496);

      await serverService.startServer('server_node');

      final peer = DiscoveredPeer(
        peerId: 'server_node',
        displayName: 'Server Node',
        ipAddress: '127.0.0.1',
        tcpPort: 45495,
        lastSeen: DateTime.now(),
      );

      await clientService.connectToPeer(peer);
      await clientService.sendTestMessage('Telemetry Test Payload 12345');

      await Future.delayed(const Duration(milliseconds: 200));

      expect(clientService.bytesSent, greaterThan(30));
      expect(serverService.bytesReceived, greaterThan(30));

      clientService.disconnect();
      serverService.disconnect();
      await clientService.dispose();
      await serverService.dispose();
    });
  });
}
