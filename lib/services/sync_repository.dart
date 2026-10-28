import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/chat_message.dart';
import '../models/conversation.dart';
import '../models/peer.dart';

/// Repository handling HTTP network REST API communication with the Node.js zero-knowledge backend.
class SyncRepository {
  final String baseUrl;
  final http.Client client;
  String? _authToken;

  SyncRepository({
    String? apiBaseUrl,
    http.Client? httpClient,
  })  : baseUrl = apiBaseUrl ?? 'http://localhost:3000/api/v1',
        client = httpClient ?? http.Client();

  void setAuthToken(String token) {
    _authToken = token;
  }

  String? get authToken => _authToken;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  /// Registers user account on Node.js backend.
  Future<Map<String, dynamic>> register({
    required String username,
    required String phoneNumber,
    required String password,
    required String publicIdentityKey,
  }) async {
    final response = await client.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'phone_number': phoneNumber,
        'password': password,
        'public_identity_key': publicIdentityKey,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      setAuthToken(data['token'] as String);
      return data;
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Registration failed');
    }
  }

  /// Authenticates user and retrieves JWT token.
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      setAuthToken(data['token'] as String);
      return data;
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Authentication failed');
    }
  }

  /// Fetches conversation list from central backend.
  Future<List<Map<String, dynamic>>> fetchConversations() async {
    final response = await client.get(
      Uri.parse('$baseUrl/conversations'),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final List list = data['conversations'] ?? [];
      return list.cast<Map<String, dynamic>>();
    } else {
      throw Exception('Failed to fetch conversations: ${response.statusCode}');
    }
  }

  /// Creates a conversation record on backend.
  Future<Map<String, dynamic>> createConversation({
    required String type,
    String? recipientUserId,
    String? encryptedKeyCreator,
    String? encryptedKeyRecipient,
  }) async {
    final response = await client.post(
      Uri.parse('$baseUrl/conversations'),
      headers: _headers,
      body: jsonEncode({
        'type': type,
        'recipient_user_id': recipientUserId,
        'encrypted_key_creator': encryptedKeyCreator,
        'encrypted_key_recipient': encryptedKeyRecipient,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['conversation'] as Map<String, dynamic>;
    } else {
      throw Exception('Failed to create conversation');
    }
  }

  /// Fetches paginated encrypted messages from backend database.
  Future<List<Map<String, dynamic>>> fetchEncryptedMessages({
    required String conversationId,
    int limit = 30,
    int? beforeSequence,
  }) async {
    String query = '$baseUrl/conversations/$conversationId/messages?limit=$limit';
    if (beforeSequence != null) {
      query += '&before_sequence=$beforeSequence';
    }

    final response = await client.get(
      Uri.parse(query),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final List list = data['messages'] ?? [];
      return list.cast<Map<String, dynamic>>();
    } else {
      throw Exception('Failed to fetch encrypted messages');
    }
  }

  /// Posts encrypted message payload to zero-knowledge sync endpoint.
  /// Strictly rejects plaintext submission.
  Future<Map<String, dynamic>> syncEncryptedMessage({
    required String conversationId,
    required String encryptedPayload,
    required String iv,
    String? senderDeviceId,
    String messageType = 'text',
  }) async {
    final response = await client.post(
      Uri.parse('$baseUrl/sync/messages'),
      headers: _headers,
      body: jsonEncode({
        'conversation_id': conversationId,
        'encrypted_payload': encryptedPayload,
        'iv': iv,
        'sender_device_id': senderDeviceId,
        'message_type': messageType,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['record'] as Map<String, dynamic>;
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Failed to sync encrypted message payload');
    }
  }

  /// Fetches synchronization sequence state.
  Future<int> fetchSyncSequence({
    required String deviceId,
    required String conversationId,
  }) async {
    final response = await client.get(
      Uri.parse('$baseUrl/sync/state?device_id=$deviceId&conversation_id=$conversationId'),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['sync_state']?['last_synced_sequence'] as int?) ?? 0;
    }
    return 0;
  }

  /// Updates synchronization sequence state.
  Future<void> updateSyncSequence({
    required String deviceId,
    required String conversationId,
    required int lastSyncedSequence,
  }) async {
    await client.post(
      Uri.parse('$baseUrl/sync/state'),
      headers: _headers,
      body: jsonEncode({
        'device_id': deviceId,
        'conversation_id': conversationId,
        'last_synced_sequence': lastSyncedSequence,
      }),
    );
  }
}
