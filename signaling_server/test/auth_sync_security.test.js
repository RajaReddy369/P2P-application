const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../api');

let server;
const PORT = 3098;

test.before((done) => {
  server = app.listen(PORT, () => {
    console.log(`Security & Sync Test API listening on port ${PORT}`);
  });
});

test.after(() => {
  if (server) server.close();
});

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: method,
        headers: headers,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(responseData) }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let tokenUserA, tokenUserB;
let userIdA, userIdB;
let convIdShared, convIdPrivateA;

test('1. Authentication & Secure Password Hashing (Register & Login)', async () => {
  // Register User A
  const regA = await request('POST', '/api/v1/auth/register', {
    username: 'user_rahul',
    phone_number: '+919876543210',
    password: 'SecurePassword123!',
    public_identity_key: 'pub_key_rahul_hex',
  });
  assert.equal(regA.status, 201);
  assert.ok(regA.data.token);
  tokenUserA = regA.data.token;
  userIdA = regA.data.user.id;

  // Register User B
  const regB = await request('POST', '/api/v1/auth/register', {
    username: 'user_priya',
    phone_number: '+919876543211',
    password: 'SecurePassword456!',
    public_identity_key: 'pub_key_priya_hex',
  });
  assert.equal(regB.status, 201);
  tokenUserB = regB.data.token;
  userIdB = regB.data.user.id;

  // Login User A
  const loginA = await request('POST', '/api/v1/auth/login', {
    username: 'user_rahul',
    password: 'SecurePassword123!',
  });
  assert.equal(loginA.status, 200);
  assert.ok(loginA.data.token);
});

test('2. Devices Registration & Listing', async () => {
  const regDevice = await request(
    'POST',
    '/api/v1/devices/register',
    {
      device_name: "Rahul's Pixel 8",
      device_type: 'mobile',
      public_device_key: 'pub_dev_key_rahul_mobile',
    },
    tokenUserA
  );
  assert.equal(regDevice.status, 201);

  const getDevices = await request('GET', '/api/v1/devices', null, tokenUserA);
  assert.equal(getDevices.status, 200);
  assert.equal(getDevices.data.devices.length, 1);
});

test('3. Conversation Creation & Membership Access Control', async () => {
  // User A creates shared conversation with User B
  const createShared = await request(
    'POST',
    '/api/v1/conversations',
    {
      type: 'direct',
      recipient_user_id: userIdB,
      encrypted_key_creator: 'envelope_for_a',
      encrypted_key_recipient: 'envelope_for_b',
    },
    tokenUserA
  );
  assert.equal(createShared.status, 201);
  convIdShared = createShared.data.conversation.id;

  // User A creates private conversation without User B
  const createPrivate = await request(
    'POST',
    '/api/v1/conversations',
    {
      type: 'direct',
      encrypted_key_creator: 'envelope_private_a',
    },
    tokenUserA
  );
  assert.equal(createPrivate.status, 201);
  convIdPrivateA = createPrivate.data.conversation.id;

  // Verify User B cannot access Private Conversation of User A (Forbidden 403)
  const forbiddenFetch = await request('GET', `/api/v1/conversations/${convIdPrivateA}/messages`, null, tokenUserB);
  assert.equal(forbiddenFetch.status, 403);
  assert.equal(forbiddenFetch.data.error, 'Forbidden: Access denied to conversation');
});

test('4. Plaintext Rejection Security Enforcement', async () => {
  // Attempt to submit plaintext message content -> MUST BE REJECTED (400)
  const rejection1 = await request(
    'POST',
    '/api/v1/sync/messages',
    {
      conversation_id: convIdShared,
      plaintext: 'Hey Priya, here is a secret message!',
      iv: 'Base64IV==',
    },
    tokenUserA
  );
  assert.equal(rejection1.status, 400);
  assert.ok(rejection1.data.error.includes('Plaintext message submission rejected'));

  const rejection2 = await request(
    'POST',
    '/api/v1/sync/messages',
    {
      conversation_id: convIdShared,
      message_text: 'Unencrypted content attempt',
      iv: 'Base64IV==',
    },
    tokenUserA
  );
  assert.equal(rejection2.status, 400);
});

test('5. Encrypted Message Payload Storage & Incremental Pagination Sync', async () => {
  // Post 5 valid encrypted payload messages
  for (let i = 1; i <= 5; i++) {
    const postRes = await request(
      'POST',
      '/api/v1/sync/messages',
      {
        conversation_id: convIdShared,
        encrypted_payload: `Base64AESGCMCiphertextPayload_${i}==`,
        iv: `Base64IV_${i}==`,
        message_type: 'text',
      },
      tokenUserA
    );
    assert.equal(postRes.status, 201);
  }

  // Fetch paginated messages with limit 3 for User B
  const page1 = await request('GET', `/api/v1/conversations/${convIdShared}/messages?limit=3`, null, tokenUserB);
  assert.equal(page1.status, 200);
  assert.equal(page1.data.messages.length, 3);
  assert.ok(page1.data.messages[0].encrypted_payload);
});

test('6. Synchronization State Tracking', async () => {
  const updateSync = await request(
    'POST',
    '/api/v1/sync/state',
    {
      device_id: 'dev_pixel_8',
      conversation_id: convIdShared,
      last_synced_sequence: 5,
    },
    tokenUserA
  );
  assert.equal(updateSync.status, 200);

  const getSync = await request('GET', `/api/v1/sync/state?device_id=dev_pixel_8&conversation_id=${convIdShared}`, null, tokenUserA);
  assert.equal(getSync.status, 200);
  assert.equal(getSync.data.sync_state.last_synced_sequence, 5);
});
