import 'package:flutter/material.dart';

import '../../crypto/peer_identity_service.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_button.dart';
import 'home_screen.dart';

class CreateIdentityScreen extends StatefulWidget {
  const CreateIdentityScreen({super.key});

  @override
  State<CreateIdentityScreen> createState() => _CreateIdentityScreenState();
}

class _CreateIdentityScreenState extends State<CreateIdentityScreen> {
  final TextEditingController _nameController = TextEditingController(text: 'Alex Rivers');
  final PeerIdentityService _identityService = PeerIdentityService();
  bool _isGeneratingKeys = false;
  String? _generatedPublicKey;
  String? _generatedFingerprint;

  Future<void> _generateIdentityKeys() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a display name first')),
      );
      return;
    }

    setState(() {
      _isGeneratingKeys = true;
    });

    final identity = await _identityService.initializeOrLoadIdentity(displayName: name);

    if (!mounted) return;
    setState(() {
      _isGeneratingKeys = false;
      _generatedPublicKey = identity.publicKey;
      _generatedFingerprint = identity.fingerprint;
    });
  }

  Future<void> _completeIdentitySetup() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your display name')),
      );
      return;
    }

    await _identityService.initializeOrLoadIdentity(displayName: name);

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Create Peer Identity'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const CircleAvatar(
              radius: 40,
              backgroundColor: AppColors.surface,
              child: Icon(Icons.key, size: 44, color: AppColors.primaryGreen),
            ),
            const SizedBox(height: 20),
            const Text(
              'Generate Public/Private Keypair',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your peer identity is cryptographically tied to your device. No central server credentials or phone numbers required.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 32),

            // Display Name Input
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Display Name',
                labelStyle: const TextStyle(color: AppColors.textSecondary),
                prefixIcon: const Icon(Icons.person, color: AppColors.primaryGreen),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              style: const TextStyle(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 24),

            // Keypair Generation Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Ed25519 Cryptographic Keypair',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_isGeneratingKeys)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.refresh, color: AppColors.primaryGreen),
                            onPressed: _generateIdentityKeys,
                          ),
                      ],
                    ),
                    const Divider(height: 16),
                    if (_generatedFingerprint != null) ...[
                      const Text(
                        'PUBLIC KEY FINGERPRINT:',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _generatedFingerprint!,
                        style: const TextStyle(
                          color: AppColors.primaryGreen,
                          fontSize: 12,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ] else ...[
                      const Text(
                        'Tap refresh to derive local Ed25519 keypair & SHA-256 fingerprint',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 36),

            // Submit Button
            SizedBox(
              width: double.infinity,
              child: CustomButton(
                text: 'Launch P2P Messenger',
                icon: Icons.arrow_forward,
                onPressed: _completeIdentitySetup,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
