import 'package:flutter/material.dart';

import '../../crypto/peer_identity_service.dart';
import '../../models/user_identity.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/peer_qr_widget.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final PeerIdentityService _identityService = PeerIdentityService();
  UserIdentity? _userIdentity;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadIdentity();
  }

  Future<void> _loadIdentity() async {
    final identity = await _identityService.initializeOrLoadIdentity();
    if (!mounted) return;
    setState(() {
      _userIdentity = identity;
      _isLoading = false;
    });
  }

  Future<void> _showQrModal() async {
    if (_userIdentity == null) return;
    final qrPayload = await _identityService.getShareableQrPayload();
    if (!mounted) return;

    PeerQrWidget.showQrModal(
      context,
      qrData: qrPayload,
      displayName: _userIdentity!.displayName,
      fingerprint: _userIdentity!.fingerprint,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final identity = _userIdentity!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Peer Identity Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 44,
                    backgroundColor: AppColors.primaryGreen,
                    child: Icon(Icons.person, size: 48, color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    identity.displayName,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Peer ID: ${identity.id}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.dividerColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'PUBLIC KEY FINGERPRINT (SHA-256):',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                          identity.fingerprint,
                          style: const TextStyle(
                            color: AppColors.primaryGreen,
                            fontSize: 12,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: CustomButton(
                          text: 'Display QR',
                          icon: Icons.qr_code_2,
                          onPressed: _showQrModal,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: CustomButton(
                          text: 'Export Key',
                          icon: Icons.share,
                          isOutlined: true,
                          onPressed: () async {
                            final payload = await _identityService.getShareableQrPayload();
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Public Key Exported:\n$payload')),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Security Status Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SECURITY & ENCRYPTION SUMMARY',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _infoTile('Peer Identity Algorithm', 'Ed25519 (32-byte public key)', Icons.fingerprint),
                  const Divider(height: 16),
                  _infoTile('E2E Key Exchange', 'Curve25519 (X25519 ECDH)', Icons.security),
                  const Divider(height: 16),
                  _infoTile('Payload Cipher', 'AES-256-GCM (Authenticated)', Icons.lock),
                  const Divider(height: 16),
                  _infoTile('Local Key Vault', 'Hardware Keystore (Android KeyStore)', Icons.vpn_key),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primaryGreen, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
