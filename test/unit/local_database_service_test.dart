import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:p2p_messenger/database/local_database_service.dart';
import 'package:p2p_messenger/models/chat_message.dart';
import 'package:p2p_messenger/models/connection_state_model.dart';
import 'package:p2p_messenger/models/conversation.dart';
import 'package:p2p_messenger/models/message.dart';
import 'package:p2p_messenger/models/message_attachment.dart';
import 'package:p2p_messenger/models/network_status.dart';
import 'package:p2p_messenger/models/peer.dart';
import 'package:p2p_messenger/models/transfer.dart';
import 'package:p2p_messenger/models/user_identity.dart';

void main() {
  // Initialize FFI bindings for SQLite in pure Dart unit test environment
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late LocalDatabaseService dbService;
  late Database db;

  setUp(() async {
    db = await openDatabase(
      inMemoryDatabasePath,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON;');
      },
      onCreate: (db, version) async {
        // Tables are created inside LocalDatabaseService constructor flow
      },
    );

    // Run table creation on the in-memory SQLite database instance
    await db.execute('PRAGMA foreign_keys = ON;');
    dbService = LocalDatabaseService(database: db);

    // Create schema manually if openDatabase onCreate wasn't called on existing handle
    final tables = await db.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='messages';");
    if (tables.isEmpty) {
      await db.execute('''
        CREATE TABLE user_identity (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          public_key TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          avatar_url TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      ''');
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
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          peer_id TEXT NOT NULL,
          last_message_id TEXT,
          unread_count INTEGER NOT NULL DEFAULT 0,
          is_p2p_connected INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (peer_id) REFERENCES peers (peer_id) ON DELETE CASCADE
        );
      ''');
      await db.execute('''
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          file_name TEXT,
          file_size INTEGER,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        );
      ''');
      await db.execute('''
        CREATE TABLE message_attachments (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          checksum TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
        );
      ''');
      await db.execute('''
        CREATE TABLE transfers (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          total_bytes INTEGER NOT NULL,
          transferred_bytes INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
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
    }
  });

  tearDown(() async {
    await db.close();
  });

  group('Phase 2 SQLite Persistence Operations', () {
    test('1. User Identity - Save and Retrieve', () async {
      final identity = UserIdentity(
        id: 'my_local_node_1',
        displayName: 'Alice Rivers',
        publicKey: 'pubkey_ed25519_x25519_sample',
        fingerprint: 'SHA256: 8F92-A1B4-7C9E-3D10',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: DateTime.now(),
      );

      await dbService.saveUserIdentity(identity);
      final retrieved = await dbService.getUserIdentity();

      expect(retrieved, isNotNull);
      expect(retrieved!.id, equals('my_local_node_1'));
      expect(retrieved.displayName, equals('Alice Rivers'));
      expect(retrieved.fingerprint, equals('SHA256: 8F92-A1B4-7C9E-3D10'));
    });

    test('2. Peer - Save and Query', () async {
      final peer = Peer(
        peerId: 'peer_bob_99',
        name: 'Bob Marley',
        fingerprint: 'SHA256: 1122-3344-5566-7788',
        avatarUrl: 'https://example.com/bob.jpg',
        isOnline: true,
        lastSeen: 'Online',
        createdAt: DateTime.now(),
      );

      await dbService.savePeer(peer);
      final peers = await dbService.getPeers();

      expect(peers, isNotEmpty);
      expect(peers.first.peerId, equals('peer_bob_99'));
      expect(peers.first.isOnline, isTrue);
    });

    test('3. Create Conversation and Retrieve', () async {
      final peer = Peer(
        peerId: 'peer_charlie_55',
        name: 'Charlie Brown',
        fingerprint: 'SHA256: AAAA-BBBB-CCCC-DDDD',
        avatarUrl: 'https://example.com/charlie.jpg',
        isOnline: true,
        lastSeen: 'Online',
        createdAt: DateTime.now(),
      );

      final conversation = Conversation(
        id: 'conv_charlie_1',
        peerId: 'peer_charlie_55',
        unreadCount: 3,
        isP2pConnected: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await dbService.createConversation(conversation, peer: peer);
      final retrieved = await dbService.retrieveConversation('conv_charlie_1');

      expect(retrieved, isNotNull);
      expect(retrieved!.id, equals('conv_charlie_1'));
      expect(retrieved.peer, isNotNull);
      expect(retrieved.peer!.name, equals('Charlie Brown'));
      expect(retrieved.unreadCount, equals(3));
    });

    test('4. Save Message & Retrieve Messages for Conversation', () async {
      final peer = Peer(
        peerId: 'peer_diana_77',
        name: 'Diana Prince',
        fingerprint: 'SHA256: 9999-8888-7777-6666',
        avatarUrl: 'https://example.com/diana.jpg',
        isOnline: false,
        lastSeen: '1 hour ago',
        createdAt: DateTime.now(),
      );

      final conversation = Conversation(
        id: 'conv_diana',
        peerId: 'peer_diana_77',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      final message1 = Message(
        id: 'msg_101',
        conversationId: 'conv_diana',
        senderId: 'peer_diana_77',
        recipientId: 'my_local_node_1',
        content: 'Hello over SCTP DataChannel!',
        timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
        status: MessageStatus.read,
      );

      final message2 = Message(
        id: 'msg_102',
        conversationId: 'conv_diana',
        senderId: 'my_local_node_1',
        recipientId: 'peer_diana_77',
        content: 'Received cleanly!',
        timestamp: DateTime.now(),
        status: MessageStatus.delivered,
      );

      await dbService.saveMessage(message1);
      await dbService.saveMessage(message2);

      final messages = await dbService.getMessagesForConversation('conv_diana');
      expect(messages.length, equals(2));
      expect(messages.first.content, equals('Hello over SCTP DataChannel!'));
      expect(messages.last.content, equals('Received cleanly!'));

      // Check updated conversation last_message_id
      final updatedConv = await dbService.retrieveConversation('conv_diana');
      expect(updatedConv!.lastMessageId, equals('msg_102'));
    });

    test('5. Update Message Status', () async {
      final peer = Peer(
        peerId: 'peer_status_test',
        name: 'Test Peer',
        fingerprint: 'SHA256: 0000',
        avatarUrl: '',
        isOnline: true,
        lastSeen: 'Now',
        createdAt: DateTime.now(),
      );
      final conversation = Conversation(
        id: 'conv_status',
        peerId: 'peer_status_test',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      final msg = Message(
        id: 'msg_status_1',
        conversationId: 'conv_status',
        senderId: 'my_local_node_1',
        recipientId: 'peer_status_test',
        content: 'Testing status update',
        status: MessageStatus.sending,
        timestamp: DateTime.now(),
      );

      await dbService.saveMessage(msg);
      await dbService.updateMessageStatus('msg_status_1', MessageStatus.read);

      final messages = await dbService.getMessagesForConversation('conv_status');
      expect(messages.first.status, equals(MessageStatus.read));
    });

    test('6. Save Attachment Metadata & Query', () async {
      final peer = Peer(
        peerId: 'peer_attach',
        name: 'Attach Peer',
        fingerprint: 'SHA256: ATTACH',
        avatarUrl: '',
        isOnline: true,
        lastSeen: 'Now',
        createdAt: DateTime.now(),
      );
      final conversation = Conversation(
        id: 'conv_attach',
        peerId: 'peer_attach',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      final msg = Message(
        id: 'msg_file_1',
        conversationId: 'conv_attach',
        senderId: 'my_local_node_1',
        recipientId: 'peer_attach',
        content: 'Sending encrypted image',
        type: MessageType.file,
        timestamp: DateTime.now(),
      );

      final attachment = MessageAttachment(
        id: 'att_100',
        messageId: 'msg_file_1',
        fileName: 'blueprint.png',
        filePath: '/local/storage/blueprint.png',
        fileSize: 1048576,
        mimeType: 'image/png',
        checksum: 'sha256_checksum_hash_value',
        createdAt: DateTime.now(),
      );

      await dbService.saveMessage(msg, attachment: attachment);

      final retrievedAttachment = await dbService.getAttachmentForMessage('msg_file_1');
      expect(retrievedAttachment, isNotNull);
      expect(retrievedAttachment!.fileName, equals('blueprint.png'));
      expect(retrievedAttachment.fileSize, equals(1048576));
      expect(retrievedAttachment.checksum, equals('sha256_checksum_hash_value'));
    });

    test('7. Search Messages', () async {
      final peer = Peer(
        peerId: 'peer_search',
        name: 'Search Peer',
        fingerprint: 'SHA256: SEARCH',
        avatarUrl: '',
        isOnline: true,
        lastSeen: 'Now',
        createdAt: DateTime.now(),
      );
      final conversation = Conversation(
        id: 'conv_search',
        peerId: 'peer_search',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      await dbService.saveMessage(Message(
        id: 'msg_s1',
        conversationId: 'conv_search',
        senderId: 'peer_search',
        recipientId: 'my_node',
        content: 'Meeting scheduled for 3 PM tomorrow',
        timestamp: DateTime.now().subtract(const Duration(minutes: 10)),
      ));

      await dbService.saveMessage(Message(
        id: 'msg_s2',
        conversationId: 'conv_search',
        senderId: 'my_node',
        recipientId: 'peer_search',
        content: 'Sounds good, let us use direct P2P video',
        timestamp: DateTime.now(),
      ));

      final searchResults = await dbService.searchMessages('meeting');
      expect(searchResults.length, equals(1));
      expect(searchResults.first.id, equals('msg_s1'));

      final p2pResults = await dbService.searchMessages('P2P');
      expect(p2pResults.length, equals(1));
      expect(p2pResults.first.id, equals('msg_s2'));
    });

    test('8. Delete Conversation (Cascade Deletion)', () async {
      final peer = Peer(
        peerId: 'peer_delete',
        name: 'Delete Peer',
        fingerprint: 'SHA256: DELETE',
        avatarUrl: '',
        isOnline: false,
        lastSeen: 'Yesterday',
        createdAt: DateTime.now(),
      );
      final conversation = Conversation(
        id: 'conv_delete_target',
        peerId: 'peer_delete',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      await dbService.saveMessage(Message(
        id: 'msg_d1',
        conversationId: 'conv_delete_target',
        senderId: 'peer_delete',
        recipientId: 'my_node',
        content: 'This conversation will be deleted',
        timestamp: DateTime.now(),
      ));

      await dbService.deleteConversation('conv_delete_target');

      final retrievedConv = await dbService.retrieveConversation('conv_delete_target');
      expect(retrievedConv, isNull);

      final messages = await dbService.getMessagesForConversation('conv_delete_target');
      expect(messages, isEmpty);
    });

    test('9. Transfer Tracking Operations', () async {
      final peer = Peer(
        peerId: 'peer_tr',
        name: 'Transfer Peer',
        fingerprint: 'SHA256: TR',
        avatarUrl: '',
        isOnline: true,
        lastSeen: 'Now',
        createdAt: DateTime.now(),
      );
      final conversation = Conversation(
        id: 'conv_tr',
        peerId: 'peer_tr',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await dbService.createConversation(conversation, peer: peer);

      final msg = Message(
        id: 'msg_tr_1',
        conversationId: 'conv_tr',
        senderId: 'my_node',
        recipientId: 'peer_tr',
        content: 'Transferring file',
        timestamp: DateTime.now(),
      );
      await dbService.saveMessage(msg);

      final transfer = Transfer(
        id: 'tr_1',
        messageId: 'msg_tr_1',
        fileName: 'dataset.zip',
        totalBytes: 5000000,
        transferredBytes: 1000000,
        status: TransferStatus.inProgress,
        startedAt: DateTime.now(),
      );

      await dbService.saveTransfer(transfer);
      final fetchedTransfer = await dbService.getTransfer('tr_1');
      expect(fetchedTransfer, isNotNull);
      expect(fetchedTransfer!.transferredBytes, equals(1000000));

      await dbService.updateTransferProgress('tr_1', 5000000, TransferStatus.completed);
      final completedTransfer = await dbService.getTransfer('tr_1');
      expect(completedTransfer!.status, equals(TransferStatus.completed));
      expect(completedTransfer.completedAt, isNotNull);
    });

    test('10. Connection State Operations', () async {
      final connState = ConnectionStateModel(
        peerId: 'peer_conn_1',
        state: P2PState.directP2P,
        activeCandidatePair: '192.168.1.100:5000 <-> 192.168.1.105:5000',
        rttMs: 12.4,
        transportType: 'Wi-Fi LAN Direct',
        lastUpdated: DateTime.now(),
      );

      await dbService.updateConnectionState(connState);
      final fetchedState = await dbService.getConnectionState('peer_conn_1');

      expect(fetchedState, isNotNull);
      expect(fetchedState!.state, equals(P2PState.directP2P));
      expect(fetchedState.rttMs, equals(12.4));
      expect(fetchedState.activeCandidatePair, contains('192.168.1.100'));
    });
  });
}
