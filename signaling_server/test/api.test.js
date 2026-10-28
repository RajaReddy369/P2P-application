const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../api');

let server;
const PORT = 3099;
let authToken = null;

test.before((done) => {
  server = app.listen(PORT, () => {
    console.log(`Test API listening on port ${PORT}`);
  });
});

test.after(() => {
  if (server) server.close();
});

function postJson(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: 'POST',
        headers: headers,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(responseData) }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.get({ hostname: 'localhost', port: PORT, path: path, headers: headers }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(responseData) }));
    });
    req.on('error', reject);
  });
}

test('1. Zero-Knowledge API Health Check', async () => {
  const res = await getJson('/api/v1/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.zero_knowledge, true);
});

test('2. User Registration & Login', async () => {
  const reg = await postJson('/api/v1/auth/register', {
    username: 'alex_rivers',
    phone_number: '+1234567890',
    password: 'password123',
    public_identity_key: 'pub_key_alex_123',
  });
  assert.equal(reg.status, 201);
  assert.ok(reg.data.token);

  const login = await postJson('/api/v1/auth/login', {
    username: 'alex_rivers',
    password: 'password123',
  });
  assert.equal(login.status, 200);
  assert.ok(login.data.token);
  authToken = login.data.token;
});

test('3. Post Encrypted Message (Zero Plaintext)', async () => {
  const conv = await postJson('/api/v1/conversations', { type: 'direct', encrypted_key_creator: 'envelope_creator_valid' }, authToken);
  assert.equal(conv.status, 201);
  const convId = conv.data.conversation.id;

  const msg = await postJson(
    '/api/v1/sync/messages',
    {
      conversation_id: convId,
      encrypted_payload: 'Base64EncryptedCiphertextBlobString==',
      iv: 'Base64IVBlob==',
    },
    authToken
  );
  assert.equal(msg.status, 201);
  assert.equal(msg.data.record.encrypted_payload, 'Base64EncryptedCiphertextBlobString==');

  const history = await getJson(`/api/v1/conversations/${convId}/messages`, authToken);
  assert.equal(history.status, 200);
  assert.equal(history.data.messages.length, 1);
  assert.equal(history.data.messages[0].encrypted_payload, 'Base64EncryptedCiphertextBlobString==');
});
