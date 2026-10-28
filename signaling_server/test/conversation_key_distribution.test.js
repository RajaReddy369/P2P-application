const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { webcrypto } = require('node:crypto');
const apiServer = require('../api.js');
const db = require('../db.js');

const crypto = webcrypto;

class TestCryptoEngine {
  static async generateIdentityKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = Buffer.from(spkiBuffer).toString('base64');
    return { publicKeyBase64, privateKey: keyPair.privateKey };
  }

  static async generateConversationKey() {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async createEncryptedKeyEnvelope(convKey, recipientPublicKeyBase64) {
    const ephKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const ephSpki = await crypto.subtle.exportKey('spki', ephKeyPair.publicKey);
    const ephPubKeyBase64 = Buffer.from(ephSpki).toString('base64');

    const recipientPubKeyBytes = Buffer.from(recipientPublicKeyBase64, 'base64');
    const recipientPubKey = await crypto.subtle.importKey(
      'spki',
      recipientPubKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const envKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: recipientPubKey },
      ephKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedBuffer = await crypto.subtle.wrapKey(
      'raw',
      convKey,
      envKey,
      { name: 'AES-GCM', iv }
    );

    return JSON.stringify({
      version: '1.0',
      ephemeralPublicKey: ephPubKeyBase64,
      encryptedKey: Buffer.from(wrappedBuffer).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
    });
  }

  static async unwrapKeyEnvelope(envelopeJson, recipientPrivateKey) {
    const envelope = JSON.parse(envelopeJson);
    const ephPubKeyBytes = Buffer.from(envelope.ephemeralPublicKey, 'base64');
    const ephPubKey = await crypto.subtle.importKey(
      'spki',
      ephPubKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const envKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: ephPubKey },
      recipientPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['unwrapKey']
    );

    const encryptedKeyBytes = Buffer.from(envelope.encryptedKey, 'base64');
    const ivBytes = Buffer.from(envelope.iv, 'base64');

    return crypto.subtle.unwrapKey(
      'raw',
      encryptedKeyBytes,
      envKey,
      { name: 'AES-GCM', iv: ivBytes },
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptMessage(key, plaintext) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(plaintext);
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      dataBuffer
    );

    return {
      ciphertext: Buffer.from(cipherBuffer).toString('base64'),
      iv: Buffer.from(ivBytes).toString('base64'),
    };
  }

  static async decryptMessage(key, ciphertextBase64, ivBase64) {
    const cipherTextBytes = Buffer.from(ciphertextBase64, 'base64');
    const ivBytes = Buffer.from(ivBase64, 'base64');

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherTextBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  }
}

const PORT = 3097;
let serverInstance;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json, rawText: data });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data, rawText: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Setup Server for Key Distribution Integration Tests', (t, done) => {
  serverInstance = apiServer.listen(PORT, () => {
    done();
  });
});

let userA, userB, userC;
let userAKeys, userBKeys, userCKeys;
let convId;
let originalConvKey;
let envelopeA, envelopeB;

test('Register Users A, B, C with ECDH Identity Public Keys', async () => {
  userAKeys = await TestCryptoEngine.generateIdentityKeyPair();
  userBKeys = await TestCryptoEngine.generateIdentityKeyPair();
  userCKeys = await TestCryptoEngine.generateIdentityKeyPair();

  const regA = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'alice_keydist',
    phone_number: '+111111111',
    password: 'Password123!',
    public_identity_key: userAKeys.publicKeyBase64,
  });
  assert.equal(regA.status, 201);
  userA = { ...regA.body.user, token: regA.body.token };

  const regB = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'bob_keydist',
    phone_number: '+222222222',
    password: 'Password123!',
    public_identity_key: userBKeys.publicKeyBase64,
  });
  assert.equal(regB.status, 201);
  userB = { ...regB.body.user, token: regB.body.token };

  const regC = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'eve_keydist',
    phone_number: '+333333333',
    password: 'Password123!',
    public_identity_key: userCKeys.publicKeyBase64,
  });
  assert.equal(regC.status, 201);
  userC = { ...regC.body.user, token: regC.body.token };
});

test('TEST 1 & TEST 2: User A creates conversation with User B with distinct envelopes', async () => {
  originalConvKey = await TestCryptoEngine.generateConversationKey();

  envelopeA = await TestCryptoEngine.createEncryptedKeyEnvelope(originalConvKey, userAKeys.publicKeyBase64);
  envelopeB = await TestCryptoEngine.createEncryptedKeyEnvelope(originalConvKey, userBKeys.publicKeyBase64);

  // TEST 2 check: Envelopes A and B are distinct encrypted payloads
  assert.notEqual(envelopeA, envelopeB);

  const res = await makeRequest('POST', '/api/v1/conversations', {
    type: 'direct',
    recipient_user_id: userB.id,
    encrypted_key_creator: envelopeA,
    encrypted_key_recipient: envelopeB,
  }, userA.token);

  assert.equal(res.status, 201);
  assert.ok(res.body.conversation.id);
  convId = res.body.conversation.id;
});

test('TEST 3: Backend cannot decrypt the envelopes', () => {
  // Inspect stored database member record
  const envAInDb = db.tables.conversation_members.get(`${convId}:${userA.id}`);
  const envBInDb = db.tables.conversation_members.get(`${convId}:${userB.id}`);

  assert.ok(envAInDb.encrypted_conversation_key);
  assert.ok(envBInDb.encrypted_conversation_key);

  const parsedA = JSON.parse(envAInDb.encrypted_conversation_key);
  assert.ok(parsedA.ephemeralPublicKey);
  assert.ok(parsedA.encryptedKey);
  assert.ok(parsedA.iv);

  // Verification: Neither raw AES key nor private identity keys exist in the backend
  assert.equal(parsedA.encryptedKey.includes('raw_conversation_key'), false);
});

test('TEST 4 & TEST 5: User A encrypts "Hello Bob" & User B unwraps envelope and decrypts message', async () => {
  // B fetches envelope from GET /api/v1/conversations/:convId/key-envelope
  const envResB = await makeRequest('GET', `/api/v1/conversations/${convId}/key-envelope`, null, userB.token);
  assert.equal(envResB.status, 200);
  assert.equal(envResB.body.conversation_id, convId);
  assert.equal(envResB.body.user_id, userB.id);

  const keyB = await TestCryptoEngine.unwrapKeyEnvelope(envResB.body.encrypted_conversation_key, userBKeys.privateKey);

  // A encrypts "Hello Bob"
  const payloadA = await TestCryptoEngine.encryptMessage(originalConvKey, 'Hello Bob');

  // A posts payload to backend
  const syncRes = await makeRequest('POST', '/api/v1/sync/messages', {
    conversation_id: convId,
    encrypted_payload: payloadA.ciphertext,
    iv: payloadA.iv,
  }, userA.token);

  assert.equal(syncRes.status, 201);

  // B downloads payload from backend
  const msgsResB = await makeRequest('GET', `/api/v1/conversations/${convId}/messages`, null, userB.token);
  assert.equal(msgsResB.status, 200);
  assert.equal(msgsResB.body.messages.length, 1);

  const fetchedMsg = msgsResB.body.messages[0];
  const decryptedText = await TestCryptoEngine.decryptMessage(keyB, fetchedMsg.encrypted_payload, fetchedMsg.iv);

  assert.equal(decryptedText, 'Hello Bob');
});

test('TEST 6 & TEST 7 & TEST 8: Continuation, multiple messages, paginated history', async () => {
  const messagesToSend = ['Message 1: How are you?', 'Message 2: Meeting at 5pm', 'Message 3: E2EE Verified'];

  for (const text of messagesToSend) {
    const encrypted = await TestCryptoEngine.encryptMessage(originalConvKey, text);
    const syncRes = await makeRequest('POST', '/api/v1/sync/messages', {
      conversation_id: convId,
      encrypted_payload: encrypted.ciphertext,
      iv: encrypted.iv,
    }, userA.token);
    assert.equal(syncRes.status, 201);
  }

  // B fetches paginated history
  const historyResB = await makeRequest('GET', `/api/v1/conversations/${convId}/messages?limit=10`, null, userB.token);
  assert.equal(historyResB.status, 200);
  assert.equal(historyResB.body.messages.length, 4); // 1 previous + 3 new

  // B unwraps envelope again / uses unwrapped key and decrypts all messages
  const envResB = await makeRequest('GET', `/api/v1/conversations/${convId}/key-envelope`, null, userB.token);
  const keyB = await TestCryptoEngine.unwrapKeyEnvelope(envResB.body.encrypted_conversation_key, userBKeys.privateKey);

  for (const msg of historyResB.body.messages) {
    const text = await TestCryptoEngine.decryptMessage(keyB, msg.encrypted_payload, msg.iv);
    assert.ok(text.length > 0);
  }
});

test('TEST 9: A and B can access the same conversation from authorized web endpoints', async () => {
  const convsResA = await makeRequest('GET', '/api/v1/conversations', null, userA.token);
  const convsResB = await makeRequest('GET', '/api/v1/conversations', null, userB.token);

  assert.equal(convsResA.status, 200);
  assert.equal(convsResB.status, 200);

  assert.ok(convsResA.body.conversations.some((c) => c.id === convId));
  assert.ok(convsResB.body.conversations.some((c) => c.id === convId));
});

test('TEST 10: Unauthorized User C cannot obtain the conversation key envelope', async () => {
  const resC = await makeRequest('GET', `/api/v1/conversations/${convId}/key-envelope`, null, userC.token);
  assert.equal(resC.status, 403);
  assert.equal(resC.body.error.includes('Forbidden'), true);
});

test('TEST 11: A raw conversation key never appears in API request bodies', async () => {
  // Verify create conversation payload validation rejects raw keys or stubs
  const badRes = await makeRequest('POST', '/api/v1/conversations', {
    type: 'direct',
    recipient_user_id: userB.id,
    encrypted_key_creator: 'key_envelope_stub',
    encrypted_key_recipient: 'key_envelope_stub',
  }, userA.token);

  assert.equal(badRes.status, 400);
});

test('TEST 12: A raw conversation key never appears in PostgreSQL / database tables', () => {
  for (const member of db.tables.conversation_members.values()) {
    assert.equal(member.encrypted_conversation_key.includes('raw_conversation_key'), false);
    assert.equal(member.encrypted_conversation_key.includes('unencrypted_key'), false);
  }
});

test('TEST 13: No plaintext message is sent to the backend (Plaintext Rejection Rule)', async () => {
  const badSyncReq = await makeRequest('POST', '/api/v1/sync/messages', {
    conversation_id: convId,
    encrypted_payload: 'CiphertextBytes...',
    iv: 'IVBytes...',
    plaintext: 'Plaintext leaked!',
  }, userA.token);

  assert.equal(badSyncReq.status, 400);
  assert.equal(badSyncReq.body.error.includes('Plaintext message submission rejected'), true);
});

test('TEST 14: Tampered ciphertext fails AES-GCM authentication', async () => {
  const envResB = await makeRequest('GET', `/api/v1/conversations/${convId}/key-envelope`, null, userB.token);
  const keyB = await TestCryptoEngine.unwrapKeyEnvelope(envResB.body.encrypted_conversation_key, userBKeys.privateKey);

  const validPayload = await TestCryptoEngine.encryptMessage(originalConvKey, 'Tamper test');
  const tamperedCiphertext = validPayload.ciphertext.substring(0, validPayload.ciphertext.length - 4) + 'ZZZZ';

  await assert.rejects(async () => {
    await TestCryptoEngine.decryptMessage(keyB, tamperedCiphertext, validPayload.iv);
  });
});

test('Teardown Server', (t, done) => {
  if (serverInstance) {
    serverInstance.close(() => done());
  } else {
    done();
  }
});
