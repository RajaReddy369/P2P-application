import '../models/chat_conversation.dart';
import '../models/chat_message.dart';
import '../models/contact_model.dart';
import '../models/peer_identity.dart';

/// Service providing local mock data for Phase 1 UI presentation.
class MockDataService {
  MockDataService._();

  static final PeerIdentity myIdentity = PeerIdentity(
    id: 'my_peer_id',
    displayName: 'Alex Rivers',
    publicKey: '3059301306072a8648ce3d020106082a8648ce3d03010703420004e4b899f1',
    fingerprint: 'SHA256: E4B8-99F1-40A2-78CD-31E9-8802-11FA-0B22',
    avatarUrl: 'https://i.pravatar.cc/150?img=11',
    createdAt: DateTime.now().subtract(const Duration(days: 12)),
  );

  static final List<ContactModel> mockContacts = [
    const ContactModel(
      peerId: 'peer_rahul_01',
      name: 'Rahul Sharma',
      fingerprint: 'SHA256: 8F92-A1B4-7C9E-3D10',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_priya_02',
      name: 'Priya Patel',
      fingerprint: 'SHA256: 3B41-D9E2-F501-8E99',
      avatarUrl: 'https://i.pravatar.cc/150?img=5',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_rohit_03',
      name: 'Rohit Verma',
      fingerprint: 'SHA256: 7E10-B8A3-D224-91FF',
      avatarUrl: 'https://i.pravatar.cc/150?img=33',
      isOnline: false,
      lastSeen: '15 mins ago',
    ),
    const ContactModel(
      peerId: 'peer_kiran_04',
      name: 'Kiran Rao',
      fingerprint: 'SHA256: 11AA-99BB-CCDD-EE44',
      avatarUrl: 'https://i.pravatar.cc/150?img=47',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_alice_98',
      name: 'Alice Smith',
      fingerprint: 'SHA256: 99FF-22AA-33BB-44CC',
      avatarUrl: 'https://i.pravatar.cc/150?img=20',
      isOnline: false,
      lastSeen: '2 hours ago',
    ),
    const ContactModel(
      peerId: 'peer_bob_44',
      name: 'Bob Johnson',
      fingerprint: 'SHA256: 44DD-55EE-66FF-77AA',
      avatarUrl: 'https://i.pravatar.cc/150?img=60',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_sneha_05',
      name: 'Sneha Reddy',
      fingerprint: 'SHA256: 55AA-66BB-77CC-88DD',
      avatarUrl: 'https://i.pravatar.cc/150?img=25',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_vikram_06',
      name: 'Vikram Singh',
      fingerprint: 'SHA256: 66BB-77CC-88DD-99EE',
      avatarUrl: 'https://i.pravatar.cc/150?img=52',
      isOnline: false,
      lastSeen: '1 day ago',
    ),
    const ContactModel(
      peerId: 'peer_ananya_07',
      name: 'Ananya Gupta',
      fingerprint: 'SHA256: 77CC-88DD-99EE-00FF',
      avatarUrl: 'https://i.pravatar.cc/150?img=32',
      isOnline: true,
      lastSeen: 'Online',
    ),
    const ContactModel(
      peerId: 'peer_arjun_08',
      name: 'Arjun Mehta',
      fingerprint: 'SHA256: 88DD-99EE-00FF-11AA',
      avatarUrl: 'https://i.pravatar.cc/150?img=14',
      isOnline: false,
      lastSeen: '3 hours ago',
    ),
  ];

  static List<ChatConversation> get mockConversations {
    return [
      ChatConversation(
        id: 'conv_rahul',
        peer: mockContacts[0],
        lastMessage: ChatMessage(
          id: 'msg_rahul_1',
          senderId: 'peer_rahul_01',
          recipientId: 'my_peer_id',
          content: 'Hey, where are you?',
          timestamp: DateTime.now().subtract(const Duration(minutes: 2)),
          status: MessageStatus.read,
        ),
        unreadCount: 1,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_priya',
        peer: mockContacts[1],
        lastMessage: ChatMessage(
          id: 'msg_priya_1',
          senderId: 'peer_priya_02',
          recipientId: 'my_peer_id',
          content: 'WebRTC DataChannel connection established cleanly!',
          timestamp: DateTime.now().subtract(const Duration(minutes: 12)),
          status: MessageStatus.read,
        ),
        unreadCount: 0,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_rohit',
        peer: mockContacts[2],
        lastMessage: ChatMessage(
          id: 'msg_rohit_1',
          senderId: 'my_peer_id',
          recipientId: 'peer_rohit_03',
          content: 'Let\'s run the STUN binding test later today.',
          timestamp: DateTime.now().subtract(const Duration(hours: 1)),
          status: MessageStatus.delivered,
        ),
        unreadCount: 0,
        isP2pConnected: false,
      ),
      ChatConversation(
        id: 'conv_kiran',
        peer: mockContacts[3],
        lastMessage: ChatMessage(
          id: 'msg_kiran_1',
          senderId: 'peer_kiran_04',
          recipientId: 'my_peer_id',
          content: 'E2EE payload received. Zero server storage active.',
          timestamp: DateTime.now().subtract(const Duration(hours: 3)),
          status: MessageStatus.read,
        ),
        unreadCount: 3,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_alice',
        peer: mockContacts[4],
        lastMessage: ChatMessage(
          id: 'msg_alice_1',
          senderId: 'peer_alice_98',
          recipientId: 'my_peer_id',
          content: 'File chunking protocol verified for 100MB video transfer.',
          timestamp: DateTime.now().subtract(const Duration(hours: 5)),
          status: MessageStatus.read,
        ),
        unreadCount: 0,
        isP2pConnected: false,
      ),
      ChatConversation(
        id: 'conv_bob',
        peer: mockContacts[5],
        lastMessage: ChatMessage(
          id: 'msg_bob_1',
          senderId: 'my_peer_id',
          recipientId: 'peer_bob_44',
          content: 'P2P voice note delivered.',
          timestamp: DateTime.now().subtract(const Duration(days: 1)),
          status: MessageStatus.sent,
        ),
        unreadCount: 0,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_sneha',
        peer: mockContacts[6],
        lastMessage: ChatMessage(
          id: 'msg_sneha_1',
          senderId: 'peer_sneha_05',
          recipientId: 'my_peer_id',
          content: 'Can you send the public key fingerprint?',
          timestamp: DateTime.now().subtract(const Duration(days: 1, hours: 2)),
          status: MessageStatus.read,
        ),
        unreadCount: 0,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_vikram',
        peer: mockContacts[7],
        lastMessage: ChatMessage(
          id: 'msg_vikram_1',
          senderId: 'peer_vikram_06',
          recipientId: 'my_peer_id',
          content: 'Meeting scheduled for tomorrow.',
          timestamp: DateTime.now().subtract(const Duration(days: 2)),
          status: MessageStatus.read,
        ),
        unreadCount: 0,
        isP2pConnected: false,
      ),
      ChatConversation(
        id: 'conv_ananya',
        peer: mockContacts[8],
        lastMessage: ChatMessage(
          id: 'msg_ananya_1',
          senderId: 'peer_ananya_07',
          recipientId: 'my_peer_id',
          content: 'Thanks for sending the document!',
          timestamp: DateTime.now().subtract(const Duration(days: 3)),
          status: MessageStatus.read,
        ),
        unreadCount: 0,
        isP2pConnected: true,
      ),
      ChatConversation(
        id: 'conv_arjun',
        peer: mockContacts[9],
        lastMessage: ChatMessage(
          id: 'msg_arjun_1',
          senderId: 'my_peer_id',
          recipientId: 'peer_arjun_08',
          content: 'Offline sync delta received.',
          timestamp: DateTime.now().subtract(const Duration(days: 4)),
          status: MessageStatus.delivered,
        ),
        unreadCount: 0,
        isP2pConnected: false,
      ),
    ];
  }

  /// Generates a large list of conversations to demonstrate support for an unlimited number of chats.
  static List<ChatConversation> generateUnlimitedConversations(int count) {
    final baseList = mockConversations;
    final List<ChatConversation> unlimited = [];
    for (int i = 0; i < count; i++) {
      final template = baseList[i % baseList.length];
      final indexStr = (i + 1).toString().padLeft(3, '0');
      unlimited.add(
        ChatConversation(
          id: 'conv_auto_$i',
          peer: ContactModel(
            peerId: 'peer_${template.peer.name.toLowerCase().replaceAll(' ', '_')}_$i',
            name: '${template.peer.name} #$indexStr',
            fingerprint: template.peer.fingerprint,
            avatarUrl: template.peer.avatarUrl,
            isOnline: i % 2 == 0,
            lastSeen: i % 2 == 0 ? 'Online' : '$i mins ago',
          ),
          lastMessage: template.lastMessage,
          unreadCount: i % 5 == 0 ? (i % 3) + 1 : 0,
          isP2pConnected: i % 2 == 0,
        ),
      );
    }
    return unlimited;
  }

  static List<ChatMessage> getMockMessagesForPeer(String peerId) {
    return [
      ChatMessage(
        id: 'm1',
        senderId: peerId,
        recipientId: 'my_peer_id',
        content: 'Hey Alex! Ready to test direct P2P messaging?',
        timestamp: DateTime.now().subtract(const Duration(minutes: 25)),
        status: MessageStatus.read,
      ),
      ChatMessage(
        id: 'm2',
        senderId: 'my_peer_id',
        recipientId: peerId,
        content: 'Yes! WebSocket signaling setup succeeded. Exchanging ICE candidates now.',
        timestamp: DateTime.now().subtract(const Duration(minutes: 20)),
        status: MessageStatus.read,
      ),
      ChatMessage(
        id: 'm3',
        senderId: peerId,
        recipientId: 'my_peer_id',
        content: 'DataChannel state is now OPEN. Sending test payload.',
        timestamp: DateTime.now().subtract(const Duration(minutes: 15)),
        status: MessageStatus.read,
      ),
      ChatMessage(
        id: 'm4',
        senderId: 'my_peer_id',
        recipientId: peerId,
        content: 'E2EE Packet received cleanly over WebRTC DataChannel!',
        timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
        status: MessageStatus.delivered,
      ),
    ];
  }
}
