import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'network_diagnostics_screen.dart';
import 'webrtc_test_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _enableTurnFallback = true;
  bool _enableP2pLogging = true;
  bool _autoChunkFiles = true;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'P2P NETWORK PREFERENCES',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.settings_ethernet, color: AppColors.primaryGreen),
                title: const Text('STUN Server Configuration', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('stun:stun.l.google.com:19302', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: AppColors.iconColor),
                onTap: () {},
              ),
              const Divider(),
              SwitchListTile(
                secondary: const Icon(Icons.swap_calls, color: AppColors.primaryGreen),
                title: const Text('Enable TURN Relay Fallback', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Fallback for symmetric enterprise NATs', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                value: _enableTurnFallback,
                activeColor: AppColors.primaryGreen,
                onChanged: (val) => setState(() => _enableTurnFallback = val),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'FILE TRANSFER & CHUNKING',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                secondary: const Icon(Icons.insert_drive_file, color: AppColors.primaryGreen),
                title: const Text('Automatic 64KB Frame Chunking', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Prevents memory overflow during P2P file transfers', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                value: _autoChunkFiles,
                activeColor: AppColors.primaryGreen,
                onChanged: (val) => setState(() => _autoChunkFiles = val),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'DIAGNOSTICS & LOGGING (RULE 14)',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                secondary: const Icon(Icons.bug_report, color: AppColors.primaryGreen),
                title: const Text('Structured P2P Event Logger', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Record WebRTC state transitions and candidate logs', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                value: _enableP2pLogging,
                activeColor: AppColors.primaryGreen,
                onChanged: (val) => setState(() => _enableP2pLogging = val),
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.hub, color: AppColors.primaryGreen),
                title: const Text('Open WebRTC DataChannel Test', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Create/Set SDP Offer/Answer & test WebRTC message passing', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: AppColors.iconColor),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const WebRtcTestScreen()),
                  );
                },
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.analytics, color: AppColors.primaryGreen),
                title: const Text('Open LAN Network Diagnostics', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('View local IP, peer discovery, telemetry & bytes sent/received', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: AppColors.iconColor),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const NetworkDiagnosticsScreen()),
                  );
                },
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.receipt_long, color: AppColors.primaryGreen),
                title: const Text('View Memory Log Stream', style: TextStyle(color: AppColors.textPrimary)),
                trailing: const Icon(Icons.chevron_right, color: AppColors.iconColor),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const NetworkDiagnosticsScreen()),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
