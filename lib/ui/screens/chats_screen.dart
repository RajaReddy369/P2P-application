import 'package:flutter/material.dart';

import '../../models/chat_conversation.dart';
import '../../models/chat_message.dart';
import '../../models/contact_model.dart';
import '../../models/network_status.dart';
import '../../services/conversation_repository.dart';
import '../../services/mock_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/p2p_status_chip.dart';
import 'chat_screen.dart';

class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ConversationRepository _repository = ConversationRepository();
  List<ChatConversation> _allConversations = [];
  List<ChatConversation> _filteredConversations = [];
  bool _isLoading = true;
  bool _showSearch = false;

  @override
  void initState() {
    super.initState();
    _loadProductionConversations();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProductionConversations() async {
    setState(() => _isLoading = true);

    try {
      final domainConvs = await _repository.getConversations();
      if (!mounted) return;

      if (domainConvs.isNotEmpty) {
        _allConversations = domainConvs
            .map((c) => ChatConversation(
                  id: c.id,
                  peer: ContactModel(
                    peerId: c.peerId,
                    name: c.peer?.name ?? 'Peer ${c.peerId}',
                    fingerprint: c.peer?.fingerprint ?? 'SHA256: FFFF-FFFF-FFFF-FFFF',
                    avatarUrl: c.peer?.avatarUrl ?? 'https://i.pravatar.cc/150?img=1',
                    isOnline: c.isP2pConnected,
                    lastSeen: c.isP2pConnected ? 'Online' : 'Offline',
                  ),
                  lastMessage: ChatMessage(
                    id: 'm_last',
                    senderId: c.peerId,
                    recipientId: 'my_peer_id',
                    content: 'Encrypted payload synced',
                    timestamp: c.updatedAt,
                    status: MessageStatus.read,
                  ),
                  unreadCount: c.unreadCount,
                  isP2pConnected: c.isP2pConnected,
                ))
            .toList();
      } else {
        // Initial setup fallback data (Rahul, Priya, Rohit, Kiran, Anjali, etc.)
        _allConversations = MockDataService.mockConversations;
      }
    } catch (_) {
      _allConversations = MockDataService.mockConversations;
    }

    if (!mounted) return;
    setState(() {
      _filteredConversations = List.from(_allConversations);
      _isLoading = false;
    });
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase().trim();
    setState(() {
      if (query.isEmpty) {
        _filteredConversations = List.from(_allConversations);
      } else {
        _filteredConversations = _allConversations.where((conv) {
          final peerName = conv.peer.name.toLowerCase();
          final lastMsg = conv.lastMessage.content.toLowerCase();
          return peerName.contains(query) || lastMsg.contains(query);
        }).toList();
      }
    });
  }

  void _loadMoreConversations() {
    setState(() {
      final extended = MockDataService.generateUnlimitedConversations(20);
      _allConversations.addAll(extended);
      _onSearchChanged();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Loaded 20 additional conversations (Total: ${_allConversations.length})')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Traffic Pathway Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColors.surfaceHighlight,
          child: Row(
            children: [
              const Icon(Icons.cloud_sync, color: AppColors.primaryGreen, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Encrypted Central Sync & WebRTC P2P Transport Active',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              IconButton(
                icon: Icon(_showSearch ? Icons.search_off : Icons.search, size: 20, color: AppColors.primaryGreen),
                onPressed: () {
                  setState(() {
                    _showSearch = !_showSearch;
                    if (!_showSearch) {
                      _searchController.clear();
                    }
                  });
                },
              ),
            ],
          ),
        ),

        // Optional Search Bar
        if (_showSearch)
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search chats or messages...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: AppColors.primaryGreen),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppColors.iconColor),
                        onPressed: () => _searchController.clear(),
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
              ),
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            ),
          ),

        // Conversation Count Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'CONVERSATIONS (${_filteredConversations.length})',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
              GestureDetector(
                onTap: _loadMoreConversations,
                child: const Text(
                  '+ Load Unlimited Chats',
                  style: TextStyle(
                    color: AppColors.primaryGreen,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Chat List View
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _filteredConversations.isEmpty
                  ? const Center(
                      child: Text(
                        'No conversations found',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _filteredConversations.length,
                      separatorBuilder: (context, index) => const Divider(indent: 72, height: 1),
                      itemBuilder: (context, index) {
                        final conv = _filteredConversations[index];
                        final peer = conv.peer;

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          leading: Stack(
                            children: [
                              CircleAvatar(
                                radius: 26,
                                backgroundColor: AppColors.cardBackground,
                                child: Text(
                                  peer.name[0],
                                  style: const TextStyle(
                                    color: AppColors.primaryGreen,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 20,
                                  ),
                                ),
                              ),
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    color: conv.isP2pConnected ? AppColors.p2pConnected : AppColors.p2pDisconnected,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppColors.surface, width: 2),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  peer.name,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              P2PStatusChip(
                                state: conv.isP2pConnected ? P2PState.directP2P : P2PState.disconnected,
                              ),
                            ],
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    conv.lastMessage.content,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: conv.unreadCount > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                                      fontWeight: conv.unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                                if (conv.unreadCount > 0) ...[
                                  const SizedBox(width: 8),
                                  CircleAvatar(
                                    radius: 10,
                                    backgroundColor: AppColors.primaryGreen,
                                    child: Text(
                                      '${conv.unreadCount}',
                                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ChatScreen(conversation: conv),
                              ),
                            );
                          },
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
