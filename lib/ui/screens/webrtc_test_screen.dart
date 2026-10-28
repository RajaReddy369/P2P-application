import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../networking/p2p_logger.dart';
import '../../networking/webrtc_service.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';

class WebRtcTestScreen extends StatefulWidget {
  const WebRtcTestScreen({super.key});

  @override
  State<WebRtcTestScreen> createState() => _WebRtcTestScreenState();
}

class _WebRtcTestScreenState extends State<WebRtcTestScreen> {
  final WebRtcService _webrtcService = WebRtcService();
  final TextEditingController _sdpInputController = TextEditingController();
  final TextEditingController _msgInputController = TextEditingController(text: 'Hello WebRTC DataChannel!');

  StreamSubscription? _telemetrySub;
  WebRtcTelemetryState _telemetry = const WebRtcTelemetryState();

  String _localSdpJson = '';
  String _iceCandidatesJson = '';

  Timer? _logTimer;
  List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    _initWebRtc();
  }

  Future<void> _initWebRtc() async {
    await _webrtcService.initializePeerConnection();

    _telemetrySub = _webrtcService.telemetryStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _telemetry = state;
      });
    });

    _webrtcService.iceCandidateStream.listen((candidate) {
      if (!mounted) return;
      final candidates = _webrtcService.localIceCandidates
          .map((c) => {'candidate': c.candidate, 'sdpMid': c.sdpMid, 'sdpMLineIndex': c.sdpMLineIndex})
          .toList();
      setState(() {
        _iceCandidatesJson = jsonEncode(candidates);
      });
    });

    _logTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _logs = List.from(P2PLogger.recentLogs);
      });
    });
  }

  @override
  void dispose() {
    _telemetrySub?.cancel();
    _logTimer?.cancel();
    _webrtcService.dispose();
    super.dispose();
  }

  Future<void> _createOffer() async {
    final offer = await _webrtcService.createOffer();
    if (!mounted) return;
    setState(() {
      _localSdpJson = jsonEncode({'type': offer.type, 'sdp': offer.sdp});
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Created SDP Offer successfully!')),
    );
  }

  Future<void> _handleRemoteOffer() async {
    final text = _sdpInputController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please paste remote SDP Offer JSON first')),
      );
      return;
    }

    try {
      final map = jsonDecode(text) as Map<String, dynamic>;
      final offer = RTCSessionDescription(map['sdp'] as String, map['type'] as String);
      final answer = await _webrtcService.handleRemoteOffer(offer);

      if (!mounted) return;
      setState(() {
        _localSdpJson = jsonEncode({'type': answer.type, 'sdp': answer.sdp});
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Set Remote Offer & Created SDP Answer!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invalid SDP Offer JSON: $e')),
      );
    }
  }

  Future<void> _handleRemoteAnswer() async {
    final text = _sdpInputController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please paste remote SDP Answer JSON first')),
      );
      return;
    }

    try {
      final map = jsonDecode(text) as Map<String, dynamic>;
      final answer = RTCSessionDescription(map['sdp'] as String, map['type'] as String);
      await _webrtcService.handleRemoteAnswer(answer);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Set Remote SDP Answer! WebRTC Connecting...')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invalid SDP Answer JSON: $e')),
      );
    }
  }

  Future<void> _sendTestMessage() async {
    final text = _msgInputController.text.trim();
    if (text.isEmpty) return;

    final sent = await _webrtcService.sendData(text);
    if (!mounted) return;

    if (sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Message sent over WebRTC DataChannel!')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Send failed: DataChannel state is ${_telemetry.dataChannelState.name}')),
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('WebRTC DataChannel Test'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // State & Telemetry Overview Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'WEBRTC DATACHANNEL TELEMETRY',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 12),
                    _stateRow('PeerConnection State', _telemetry.connectionState.name, Icons.hub),
                    const Divider(height: 16),
                    _stateRow('DataChannel State', _telemetry.dataChannelState.name, Icons.cable),
                    const Divider(height: 16),
                    _stateRow('Signaling State', _telemetry.signalingState.name, Icons.cell_tower),
                    const Divider(height: 16),
                    _stateRow('ICE Connection State', _telemetry.iceConnectionState.name, Icons.wifi_tethering),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Bytes Metrics Grid
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          const Icon(Icons.upload, color: AppColors.primaryGreen, size: 20),
                          const SizedBox(height: 4),
                          Text(_formatBytes(_telemetry.bytesSent), style: const TextStyle(color: AppColors.primaryGreen, fontSize: 16, fontWeight: FontWeight.bold)),
                          const Text('Bytes Sent', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          const Icon(Icons.download, color: AppColors.signalingActive, size: 20),
                          const SizedBox(height: 4),
                          Text(_formatBytes(_telemetry.bytesReceived), style: const TextStyle(color: AppColors.signalingActive, fontSize: 16, fontWeight: FontWeight.bold)),
                          const Text('Bytes Received', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // SDP Negotiation Controls
            const Text(
              'SDP OFFER / ANSWER NEGOTIATION',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: CustomButton(
                            text: '1. Create Offer',
                            icon: Icons.unfold_more,
                            onPressed: _createOffer,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: CustomButton(
                            text: '2. Create Answer',
                            icon: Icons.unfold_less,
                            isOutlined: true,
                            onPressed: _handleRemoteOffer,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _sdpInputController,
                      maxLines: 3,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontFamily: 'monospace'),
                      decoration: InputDecoration(
                        hintText: 'Paste Remote SDP Offer/Answer JSON here...',
                        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                        filled: true,
                        fillColor: AppColors.surface,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _handleRemoteOffer,
                            icon: const Icon(Icons.downloading, size: 16),
                            label: const Text('Set Remote Offer'),
                            style: OutlinedButton.styleFrom(foregroundColor: AppColors.signalingActive),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _handleRemoteAnswer,
                            icon: const Icon(Icons.check_circle_outline, size: 16),
                            label: const Text('Set Remote Answer'),
                            style: OutlinedButton.styleFrom(foregroundColor: AppColors.p2pConnected),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // DataChannel Message Transceiver
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SCTP DATACHANNEL MESSAGE TRANSCEIVER',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _msgInputController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Type DataChannel test message...',
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
                      const Text('RECEIVED DATACHANNEL MESSAGES:', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      ..._telemetry.receivedMessages.map(
                        (m) => Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(6)),
                          child: Text(m, style: const TextStyle(color: AppColors.primaryGreen, fontSize: 12, fontFamily: 'monospace')),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // WebRTC Event Logger (Rule 14 & 19)
            const Text(
              'WEBRTC STATE TRANSITION LOGS (RULE 14)',
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
                  return Text(
                    _logs[index],
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

  Widget _stateRow(String label, String value, IconData icon) {
    final isGood = value.contains('Connected') || value.contains('Open') || value.contains('Stable');
    final color = isGood ? AppColors.p2pConnected : AppColors.textSecondary;

    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'monospace')),
            ],
          ),
        ),
      ],
    );
  }
}
