import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/chat_message.dart';
import '../models/connection_state_model.dart';
import '../models/conversation.dart';
import '../models/message.dart';
import '../models/message_attachment.dart';
import '../models/peer.dart';
import '../models/transfer.dart';
import '../models/user_identity.dart';
import 'local_storage_interface.dart';

/// Concrete SQLite Local Database implementation for P2P Messenger.
/// Manages zero-cloud, strictly local persistent tables.
class LocalDatabaseService implements LocalStorageInterface {
  static Database? _databaseInstance;
  final Database? _injectedDb;

  LocalDatabaseService({Database? database}) : _injectedDb = database;

  /// Returns active SQLite database handle.
  Future<Database> get database async {
    if (_injectedDb != null) return _injectedDb!;
    if (_databaseInstance != null) return _databaseInstance!;

    _databaseInstance = await _initDatabase('p2p_messenger.db');
    return _databaseInstance!;
  }

  static Future<Database> _initDatabase(String dbName) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, dbName);

    return await openDatabase(
      path,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON;');
      },
      onCreate: _createDbTables,
    );
  }

  /// Creates all 7 local SQLite database tables matching Phase 2 specifications.
  static Future<void> _createDbTables(Database db, int version) async {
    // 1. UserIdentity table
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

    // 2. Peers table
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

    // 3. Conversations table
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

    // 4. Messages table
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

    // 5. MessageAttachments table
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

    // 6. Transfers table
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

    // 7. ConnectionStates table
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

  // --- Identity & Peer Operations ---

  @override
  Future<void> saveUserIdentity(UserIdentity identity) async {
    final db = await database;
    await db.insert(
      'user_identity',
      identity.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<UserIdentity?> getUserIdentity() async {
    final db = await database;
    final results = await db.query('user_identity', limit: 1);
    if (results.isEmpty) return null;
    return UserIdentity.fromMap(results.first);
  }

  @override
  Future<void> savePeer(Peer peer) async {
    final db = await database;
    await db.insert(
      'peers',
      peer.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<List<Peer>> getPeers() async {
    final db = await database;
    final results = await db.query('peers', orderBy: 'name ASC');
    return results.map((m) => Peer.fromMap(m)).toList();
  }

  // --- Conversation Operations ---

  @override
  Future<void> createConversation(Conversation conversation, {Peer? peer}) async {
    final db = await database;
    await db.transaction((txn) async {
      if (peer != null) {
        await txn.insert(
          'peers',
          peer.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await txn.insert(
        'conversations',
        conversation.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });
  }

  @override
  Future<Conversation?> retrieveConversation(String conversationId) async {
    final db = await database;
    final results = await db.query(
      'conversations',
      where: 'id = ?',
      whereArgs: [conversationId],
    );
    if (results.isEmpty) return null;

    final convMap = results.first;
    final peerId = convMap['peer_id'] as String;

    final peerResults = await db.query(
      'peers',
      where: 'peer_id = ?',
      whereArgs: [peerId],
    );
    final peer = peerResults.isNotEmpty ? Peer.fromMap(peerResults.first) : null;

    return Conversation.fromMap(convMap, peer: peer);
  }

  @override
  Future<List<Conversation>> getConversations() async {
    final db = await database;
    final results = await db.query('conversations', orderBy: 'updated_at DESC');

    final List<Conversation> conversations = [];
    for (final convMap in results) {
      final peerId = convMap['peer_id'] as String;
      final peerResults = await db.query('peers', where: 'peer_id = ?', whereArgs: [peerId]);
      final peer = peerResults.isNotEmpty ? Peer.fromMap(peerResults.first) : null;
      conversations.add(Conversation.fromMap(convMap, peer: peer));
    }
    return conversations;
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    final db = await database;
    await db.delete(
      'conversations',
      where: 'id = ?',
      whereArgs: [conversationId],
    );
  }

  // --- Message Operations ---

  @override
  Future<void> saveMessage(Message message, {MessageAttachment? attachment}) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.insert(
        'messages',
        message.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Update conversation's last_message_id and updated_at
      await txn.update(
        'conversations',
        {
          'last_message_id': message.id,
          'updated_at': message.timestamp.toIso8601String(),
        },
        where: 'id = ?',
        whereArgs: [message.conversationId],
      );

      if (attachment != null) {
        await txn.insert(
          'message_attachments',
          attachment.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  @override
  Future<List<Message>> getMessagesForConversation(String conversationId) async {
    final db = await database;
    final results = await db.query(
      'messages',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      orderBy: 'timestamp ASC',
    );
    return results.map((m) => Message.fromMap(m)).toList();
  }

  @override
  Future<void> updateMessageStatus(String messageId, MessageStatus status) async {
    final db = await database;
    await db.update(
      'messages',
      {'status': status.name},
      where: 'id = ?',
      whereArgs: [messageId],
    );
  }

  @override
  Future<List<Message>> searchMessages(String query) async {
    final db = await database;
    final results = await db.query(
      'messages',
      where: 'content LIKE ?',
      whereArgs: ['%$query%'],
      orderBy: 'timestamp DESC',
    );
    return results.map((m) => Message.fromMap(m)).toList();
  }

  // --- Attachment & Transfer Operations ---

  @override
  Future<void> saveAttachmentMetadata(MessageAttachment attachment) async {
    final db = await database;
    await db.insert(
      'message_attachments',
      attachment.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<MessageAttachment?> getAttachmentForMessage(String messageId) async {
    final db = await database;
    final results = await db.query(
      'message_attachments',
      where: 'message_id = ?',
      whereArgs: [messageId],
      limit: 1,
    );
    if (results.isEmpty) return null;
    return MessageAttachment.fromMap(results.first);
  }

  @override
  Future<void> saveTransfer(Transfer transfer) async {
    final db = await database;
    await db.insert(
      'transfers',
      transfer.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<Transfer?> getTransfer(String transferId) async {
    final db = await database;
    final results = await db.query(
      'transfers',
      where: 'id = ?',
      whereArgs: [transferId],
    );
    if (results.isEmpty) return null;
    return Transfer.fromMap(results.first);
  }

  @override
  Future<void> updateTransferProgress(String transferId, int transferredBytes, TransferStatus status) async {
    final db = await database;
    final updates = <String, dynamic>{
      'transferred_bytes': transferredBytes,
      'status': status.name,
    };
    if (status == TransferStatus.completed) {
      updates['completed_at'] = DateTime.now().toIso8601String();
    }
    await db.update(
      'transfers',
      updates,
      where: 'id = ?',
      whereArgs: [transferId],
    );
  }

  // --- Telemetry & Connection State Operations ---

  @override
  Future<void> updateConnectionState(ConnectionStateModel connectionState) async {
    final db = await database;
    await db.insert(
      'connection_states',
      connectionState.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<ConnectionStateModel?> getConnectionState(String peerId) async {
    final db = await database;
    final results = await db.query(
      'connection_states',
      where: 'peer_id = ?',
      whereArgs: [peerId],
    );
    if (results.isEmpty) return null;
    return ConnectionStateModel.fromMap(results.first);
  }
}
