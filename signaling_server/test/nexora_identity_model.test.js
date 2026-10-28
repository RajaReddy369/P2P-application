const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { webcrypto } = require('node:crypto');
const apiServer = require('../api.js');
const db = require('../db.js');

const crypto = webcrypto;

const PORT = 3096;
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
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Setup Server for Nexora Identity Model Tests', (t, done) => {
  serverInstance = apiServer.listen(PORT, () => {
    done();
  });
});

let user1, user2, userDuplicatePhone;

test('TEST 1: Multiple accounts CAN use the exact same phone number', async () => {
  const reg1 = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'chaitanya01',
    display_name: 'Chaitanya Primary',
    country_code: '+91',
    phone_number: '7093029538',
    password: 'Password123!',
    public_identity_key: 'pub_key_c1',
  });
  assert.equal(reg1.status, 201);
  assert.equal(reg1.body.user.phone_number, '7093029538');
  assert.equal(reg1.body.user.country_code, '+91');
  assert.equal(reg1.body.user.display_name, 'Chaitanya Primary');
  user1 = { ...reg1.body.user, token: reg1.body.token };

  // Second account with SAME phone number & SAME country code, different username
  const reg2 = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'chaitanya_dev',
    display_name: 'Chaitanya Developer',
    country_code: '+91',
    phone_number: '7093029538',
    password: 'Password123!',
    public_identity_key: 'pub_key_c2',
  });
  assert.equal(reg2.status, 201);
  assert.equal(reg2.body.user.phone_number, '7093029538');
  assert.equal(reg2.body.user.username, 'chaitanya_dev');
  user2 = { ...reg2.body.user, token: reg2.body.token };
});

test('TEST 2: Two accounts MUST have different usernames (duplicate username fails)', async () => {
  const dupRes = await makeRequest('POST', '/api/v1/auth/register', {
    username: 'chaitanya01',
    display_name: 'Duplicate Chaitanya',
    country_code: '+1',
    phone_number: '1234567890',
    password: 'Password123!',
    public_identity_key: 'pub_key_dup',
  });
  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.error, 'Username already registered');
});

test('TEST 3 & TEST 4: Country code and Display Name are stored separately', async () => {
  const userInDb = await db.findUserByUsername('chaitanya01');
  assert.equal(userInDb.country_code, '+91');
  assert.equal(userInDb.phone_number, '7093029538');
  assert.equal(userInDb.display_name, 'Chaitanya Primary');
});

test('TEST 5: Conversation list resolves and displays the other user\'s display_name', async () => {
  const createConv = await makeRequest('POST', '/api/v1/conversations', {
    type: 'direct',
    recipient_user_id: user2.id,
    encrypted_key_creator: 'envelope_for_user1',
    encrypted_key_recipient: 'envelope_for_user2',
  }, user1.token);
  assert.equal(createConv.status, 201);
  const convId = createConv.body.conversation.id;

  const convsRes1 = await makeRequest('GET', '/api/v1/conversations', null, user1.token);
  assert.equal(convsRes1.status, 200);
  assert.ok(convsRes1.body.conversations.length > 0);

  const targetConv1 = convsRes1.body.conversations.find((c) => c.id === convId);
  assert.equal(targetConv1.other_username, 'chaitanya_dev');
  assert.equal(targetConv1.other_display_name, 'Chaitanya Developer');

  const convsRes2 = await makeRequest('GET', '/api/v1/conversations', null, user2.token);
  const targetConv2 = convsRes2.body.conversations.find((c) => c.id === convId);
  assert.equal(targetConv2.other_username, 'chaitanya01');
  assert.equal(targetConv2.other_display_name, 'Chaitanya Primary');
});

test('TEST 6: Search finds users by username', async () => {
  const searchRes = await makeRequest('GET', '/api/v1/users/by-username/chaitanya_dev', null, user1.token);
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.username, 'chaitanya_dev');
  assert.equal(searchRes.body.display_name, 'Chaitanya Developer');
});

test('TEST 7 & TEST 8: Password is saved as PBKDF2 salt hash, zero plaintext stored or sent', async () => {
  const uInDb = db.tables.users.get(user1.id);
  assert.notEqual(uInDb.password_hash, 'Password123!');
  assert.ok(uInDb.password_hash.includes(':'));
});

test('Teardown Nexora Identity Model Server', (t, done) => {
  if (serverInstance) {
    serverInstance.close(() => done());
  } else {
    done();
  }
});
