import 'package:flutter/material.dart';

import '../../crypto/peer_identity_service.dart';
import '../../models/peer.dart';
import '../theme/app_colors.dart';

/// Dialog enabling peer pairing by pasting or scanning QR payload data.
class ImportPeerDialog extends StatefulWidget {
  final PeerIdentityService identityService;
  final ValueChanged<Peer>? onPeerImported;

  const ImportPeerDialog({
    super.key,
    required this.identityService,
    this.onPeerImported,
  });

  static Future<Peer?> show(BuildContext context, PeerIdentityService identityService) {
    return showDialog<Peer>(
      context: context,
      builder: (ctx) => ImportPeerDialog(identityService: identityService),
    );
  }

  @override
  State<ImportPeerDialog> createState() => _ImportPeerDialogState();
}

class _ImportPeerDialogState extends State<ImportPeerDialog> {
  final TextEditingController _qrDataController = TextEditingController();
  bool _isImporting = false;
  String? _errorMessage;

  Future<void> _processImport() async {
    final payload = _qrDataController.text.trim();
    if (payload.isEmpty) {
      setState(() => _errorMessage = 'Please paste QR payload JSON data');
      return;
    }

    setState(() {
      _isImporting = true;
      _errorMessage = null;
    });

    try {
      final peer = await widget.identityService.importPeerFromQrPayload(payload);
      if (!mounted) return;
      widget.onPeerImported?.call(peer);
      Navigator.of(context).pop(peer);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _isImporting = false;
        _errorMessage = 'Invalid QR payload or fingerprint verification failed.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      title: const Row(
        children: [
          Icon(Icons.qr_code_scanner, color: AppColors.primaryGreen),
          SizedBox(width: 10),
          Text('Import Peer Identity', style: TextStyle(color: AppColors.textPrimary, fontSize: 18)),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Paste peer QR payload JSON to pair public key out-of-band:',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qrDataController,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontFamily: 'monospace'),
            decoration: InputDecoration(
              hintText: '{"peer_id":"peer_...","public_key":"...","fingerprint":"SHA256:..."}',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 11),
              filled: true,
              fillColor: AppColors.cardBackground,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(_errorMessage!, style: const TextStyle(color: AppColors.p2pDisconnected, fontSize: 12)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
        ),
        ElevatedButton(
          onPressed: _isImporting ? null : _processImport,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryGreen, foregroundColor: Colors.white),
          child: _isImporting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Import & Pair Peer'),
        ),
      ],
    );
  }
}
