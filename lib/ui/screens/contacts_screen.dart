import 'package:flutter/material.dart';

import '../../crypto/peer_identity_service.dart';
import '../../database/local_database_service.dart';
import '../../models/contact_model.dart';
import '../../models/peer.dart';
import '../../services/mock_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/import_peer_dialog.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final LocalDatabaseService _dbService = LocalDatabaseService();
  final PeerIdentityService _identityService = PeerIdentityService();
  List<ContactModel> _contacts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  Future<void> _loadContacts() async {
    final dbPeers = await _dbService.getPeers();
    List<ContactModel> contacts;

    if (dbPeers.isNotEmpty) {
      contacts = dbPeers
          .map((p) => ContactModel(
                peerId: p.peerId,
                name: p.name,
                fingerprint: p.fingerprint,
                avatarUrl: p.avatarUrl,
                isOnline: p.isOnline,
                lastSeen: p.lastSeen,
              ))
          .toList();
    } else {
      contacts = MockDataService.mockContacts;
    }

    if (!mounted) return;
    setState(() {
      _contacts = contacts;
      _isLoading = false;
    });
  }

  Future<void> _openImportPeerDialog() async {
    final importedPeer = await ImportPeerDialog.show(context, _identityService);
    if (importedPeer != null) {
      await _loadContacts();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Successfully paired peer ${importedPeer.name}!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView.separated(
      itemCount: _contacts.length + 1,
      separatorBuilder: (context, index) => const Divider(indent: 72),
      itemBuilder: (context, index) {
        if (index == 0) {
          return ListTile(
            leading: const CircleAvatar(
              backgroundColor: AppColors.primaryGreen,
              child: Icon(Icons.qr_code_scanner, color: Colors.white),
            ),
            title: const Text(
              'Scan / Import QR Identity to Pair Peer',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
            subtitle: const Text(
              'Out-of-band Ed25519 Public Key & SHA-256 fingerprint verification',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            onTap: _openImportPeerDialog,
          );
        }

        final contact = _contacts[index - 1];

        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          leading: CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.cardBackground,
            child: Text(
              contact.name.isNotEmpty ? contact.name[0] : 'P',
              style: const TextStyle(
                color: AppColors.primaryGreen,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          title: Text(
            contact.name,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 2),
              Text(
                contact.fingerprint,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
              Text(
                contact.isOnline ? 'Online (P2P Direct)' : 'Offline (${contact.lastSeen})',
                style: TextStyle(
                  color: contact.isOnline ? AppColors.p2pConnected : AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Contact ${contact.name} selected')),
            );
          },
        );
      },
    );
  }
}
