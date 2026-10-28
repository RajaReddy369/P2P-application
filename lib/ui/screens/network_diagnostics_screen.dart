import 'dart:async';
import 'package:flutter/material.dart';

import '../../crypto/peer_identity_service.dart';
import '../../networking/lan_discovery_service.dart';
import '../../networking/lan_socket_service.dart';
import '../../networking/lan_telemetry_model.dart';
import '../../networking/p2p_logger.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';

class NetworkDiagnosticsScreen extends StatefulWidget {
  const NetworkDiagnosticsScreen({super.key});

  @override
  State<NetworkDiagnosticsScreen> createState() => _NetworkDiagnosticsScreenState();
}

class _NetworkDiagnosticsScreenState extends State<NetworkDiagnosticsScreen> {
  final PeerIdentityService _identityService = PeerIdentityService();
  late LanDiscoveryService _discoveryService;
  late LanSocketService _socketService;

  StreamSubscription? _peersSub;
  StreamSubscription? _telemetrySub;

  String _localIp = '127.0.0.1';
  String _localPeerId = 'Loading...';
  String _displayName = 'Local User';

  List<DiscoveredPeer> _discoveredPeers = [];
  LanTelemetryState _telemetry = const LanTelemetryState(
    localIp: '127.0.0.1',
    localPeerId: 'local_node',
  );

  final TextEditingController _msgController = TextEditingController(text: 'Hello over direct Wi-Fi P2P!');
  Timer? _logRefreshTimer;
  List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    _discoveryService = LanDiscoveryService();
    _socketService = LanSocketService();
    _initNetworkDiagnostics();
  }

  Future<void> _initNetworkDiagnostics() async {
    final identity = await _identityService.initializeOrLoadIdentity();
    if (!mounted) return;

    setState(() {
      _localPeerId = identity.id;
      _displayName = identity.displayName;
    });

    // Start UDP discovery and TCP server listener
    await _discoveryService.startDiscovery(_localPeerId, _displayName);
    await _socketService.startServer(_localPeerId);

    setState(() {
      _localIp = _discoveryService.localIp;
    });

    _peersSub = _discoveryService.discoveredPeersStream.listen((peers) {
      if (!mounted) return;
      setState(() {
        _discoveredPeers = peers;
      });
    });

    _telemetrySub = _socketService.telemetryStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _telemetry = state;
      });
    });

    // Refresh memory log stream every 1 second
    _logRefreshTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _logs = List.from(P2PLogger.recentLogs);
      });
    });
  }

  @override
  void dispose() {
    _peersSub?.cancel();
    _telemetrySub?.cancel();
    _logRefreshTimer?.cancel();
    _discoveryService.stopDiscovery();
    _socketService.dispose();
    super.dispose();
  }

  Future<void> _connectToPeer(DiscoveredPeer peer) async {
    final success = await _socketService.connectToPeer(peer);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success
            ? 'Connected direct P2P socket to ${peer.displayName}!'
            : 'Failed to connect to ${peer.ipAddress}'),
      ),
    );
  }

  Future<void> _sendTestMessage() async {
    final text = _msgController.text.trim();
    if (text.isEmpty) return;

    final sent = await _socketService.sendTestMessage(text);
    if (!mounted) return;
    if (sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('P2P Test Message transmitted successfully!')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed: No active P2P TCP socket connection')),
      );
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _telemetry.status == LanConnectionStatus.connected
        ? AppColors.p2pConnected
        : _telemetry.status == LanConnectionStatus.connecting
            ? AppColors.signalingActive
            : AppColors.textMuted;

    return Scaffold(
      appBar: AppBar(
        title: const Text('LAN Network Diagnostics'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Local Telemetry Overview Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'LOCAL NODE TELEMETRY',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: statusColor),
                          ),
                          child: Text(
                            _telemetry.status.name.toUpperCase(),
                            style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _infoRow('Local IP Address', _localIp, Icons.wifi),
                    const Divider(height: 16),
                    _infoRow('Peer Identifier', _localPeerId, Icons.fingerprint),
                    const Divider(height: 16),
                    _infoRow(
                      'Connected Peer',
                      _telemetry.connectedPeer != null
                          ? '${_telemetry.connectedPeer!.displayName} (${_telemetry.connectedPeer!.ipAddress})'
                          : 'None',
                      Icons.devices,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Traffic & Performance Metrics Grid
            Row(
              children: [
                Expanded(
                  child: _metricCard(
                    'Bytes Sent',
                    _formatBytes(_telemetry.bytesSent),
                    Icons.upload,
                    AppColors.primaryGreen,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _metricCard(
                    'Bytes Received',
                    _formatBytes(_telemetry.bytesReceived),
                    Icons.download,
                    AppColors.signalingActive,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _metricCard(
                    'Latency RTT',
                    '${_telemetry.latencyMs.toStringAsFixed(1)} ms',
                    Icons.speed,
                    AppColors.p2pRelay,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Discovered Peers List
            const Text(
              'DISCOVERED WI-FI LAN PEERS',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            if (_discoveredPeers.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Center(
                    child: Column(
                      children: const [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Searching local Wi-Fi subnet via UDP broadcast (Port 45454)...',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _discoveredPeers.length,
                itemBuilder: (context, index) {
                  final peer = _discoveredPeers[index];
                  final isConnected = _telemetry.connectedPeer?.peerId == peer.peerId;

                  return Card(
                    child: ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.primaryGreen,
                        child: Icon(Icons.wifi_tethering, color: Colors.white, size: 20),
                      ),
                      title: Text(peer.displayName, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                      subtitle: Text('${peer.ipAddress}:${peer.tcpPort} • ${peer.peerId}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontFamily: 'monospace')),
                      trailing: isConnected
                          ? const Chip(
                              label: Text('Connected', style: TextStyle(fontSize: 11, color: Colors.white)),
                              backgroundColor: AppColors.primaryGreen,
                            )
                          : OutlinedButton(
                              onPressed: () => _connectToPeer(peer),
                              style: OutlinedButton.styleFrom(foregroundColor: AppColors.primaryGreen),
                              child: const Text('Connect P2P'),
                            ),
                    ),
                  );
                },
              ),
            const SizedBox(height: 20),

            // P2P Test Message Trigger
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'DIRECT P2P TEST MESSAGE SENDER',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _msgController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Enter test message...',
                              hintStyle: const TextStyle(color: AppColors.textMuted),
                              filled: true,
                              fillColor: AppColors.surface,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        CustomButton(
                          text: 'Send',
                          icon: Icons.send,
                          onPressed: _sendTestMessage,
                        ),
                      ],
                    ),
                    if (_telemetry.receivedMessages.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Divider(),
                      const Text('RECEIVED P2P TEST MESSAGES:', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      ..._telemetry.receivedMessages.map(
                        (msg) => Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(6)),
                          child: Text(msg, style: const TextStyle(color: AppColors.primaryGreen, fontSize: 12, fontFamily: 'monospace')),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Structured Memory Logs View (Rule 14 & 19)
            const Text(
              'P2P EVENT & SIGNALING LOGGER (RULE 14)',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),
            Container(
              height: 180,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.dividerColor),
              ),
              child: ListView.builder(
                itemCount: _logs.length,
                itemBuilder: (context, index) {
                  final log = _logs[index];
                  return Text(
                    log,
                    style: const TextStyle(color: Color(0xFF00FF66), fontSize: 10, fontFamily: 'monospace'),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primaryGreen, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              Text(value, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'monospace')),
            ],
          ),
        ),
      ],
    );
  }

  Widget _metricCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(title, style: const TextStyle(color: AppColors.textMuted, fontSize: 10), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
