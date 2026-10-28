const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { WebSocket } = require('ws');
const SignalingServer = require('../server');

const TEST_PORT = 8089;
let server;

function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function getNextMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

function delay(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

before(() => {
  server = new SignalingServer(TEST_PORT);
  server.start();
});

after(() => {
  if (server) server.stop();
});

test('1. Create Signaling Room', async () => {
  const wsAlice = await createClient();

  wsAlice.send(JSON.stringify({
    type: 'create_room',
    peer_id: 'peer_alice',
    room_id: 'room_1'
  }));

  const msg = await getNextMessage(wsAlice);
  assert.strictEqual(msg.type, 'room_created');
  assert.strictEqual(msg.room_id, 'room_1');
  assert.strictEqual(msg.peer_id, 'peer_alice');

  wsAlice.terminate();
  await delay();
});

test('2. Join Signaling Room and Peer Notification', async () => {
  const wsAlice = await createClient();
  const wsBob = await createClient();

  wsAlice.send(JSON.stringify({ type: 'create_room', peer_id: 'peer_alice', room_id: 'room_2' }));
  await getNextMessage(wsAlice);

  const aliceMsgPromise = getNextMessage(wsAlice);
  const bobMsgPromise = getNextMessage(wsBob);

  wsBob.send(JSON.stringify({ type: 'join_room', peer_id: 'peer_bob', room_id: 'room_2' }));

  const [aliceNotify, bobNotify] = await Promise.all([aliceMsgPromise, bobMsgPromise]);
  assert.strictEqual(aliceNotify.type, 'peer_joined');
  assert.strictEqual(aliceNotify.peer_id, 'peer_bob');

  assert.strictEqual(bobNotify.type, 'room_joined');
  assert.strictEqual(bobNotify.existing_peers[0], 'peer_alice');

  wsAlice.terminate();
  wsBob.terminate();
  await delay();
});

test('3. Exchange SDP Offer & Answer', async () => {
  const wsAlice = await createClient();
  const wsBob = await createClient();

  wsAlice.send(JSON.stringify({ type: 'create_room', peer_id: 'alice_3', room_id: 'room_3' }));
  await getNextMessage(wsAlice);

  const aliceJoinPromise = getNextMessage(wsAlice);
  const bobJoinPromise = getNextMessage(wsBob);
  wsBob.send(JSON.stringify({ type: 'join_room', peer_id: 'bob_3', room_id: 'room_3' }));
  await Promise.all([aliceJoinPromise, bobJoinPromise]);

  // Alice sends SDP offer targeting Bob
  const offerSdp = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1' };
  const bobOfferPromise = getNextMessage(wsBob);
  wsAlice.send(JSON.stringify({
    type: 'sdp_offer',
    room_id: 'room_3',
    sender_id: 'alice_3',
    target_id: 'bob_3',
    sdp: offerSdp
  }));

  const bobOffer = await bobOfferPromise;
  assert.strictEqual(bobOffer.type, 'sdp_offer');
  assert.strictEqual(bobOffer.sender_id, 'alice_3');
  assert.deepStrictEqual(bobOffer.sdp, offerSdp);

  // Bob sends SDP answer targeting Alice
  const answerSdp = { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1' };
  const aliceAnswerPromise = getNextMessage(wsAlice);
  wsBob.send(JSON.stringify({
    type: 'sdp_answer',
    room_id: 'room_3',
    sender_id: 'bob_3',
    target_id: 'alice_3',
    sdp: answerSdp
  }));

  const aliceAnswer = await aliceAnswerPromise;
  assert.strictEqual(aliceAnswer.type, 'sdp_answer');
  assert.strictEqual(aliceAnswer.sender_id, 'bob_3');
  assert.deepStrictEqual(aliceAnswer.sdp, answerSdp);

  wsAlice.terminate();
  wsBob.terminate();
  await delay();
});

test('4. Exchange ICE Candidates', async () => {
  const wsAlice = await createClient();
  const wsBob = await createClient();

  wsAlice.send(JSON.stringify({ type: 'create_room', peer_id: 'alice_4', room_id: 'room_4' }));
  await getNextMessage(wsAlice);

  const aliceJoinPromise = getNextMessage(wsAlice);
  const bobJoinPromise = getNextMessage(wsBob);
  wsBob.send(JSON.stringify({ type: 'join_room', peer_id: 'bob_4', room_id: 'room_4' }));
  await Promise.all([aliceJoinPromise, bobJoinPromise]);

  const candidateObj = { candidate: 'candidate:1 1 UDP 2122186751 192.168.1.100 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  const bobIcePromise = getNextMessage(wsBob);
  wsAlice.send(JSON.stringify({
    type: 'ice_candidate',
    room_id: 'room_4',
    sender_id: 'alice_4',
    target_id: 'bob_4',
    candidate: candidateObj
  }));

  const receivedIce = await bobIcePromise;
  assert.strictEqual(receivedIce.type, 'ice_candidate');
  assert.strictEqual(receivedIce.sender_id, 'alice_4');
  assert.deepStrictEqual(receivedIce.candidate, candidateObj);

  wsAlice.terminate();
  wsBob.terminate();
  await delay();
});

test('5. Leave Room & Connection Cleanup', async () => {
  const wsAlice = await createClient();
  const wsBob = await createClient();

  wsAlice.send(JSON.stringify({ type: 'create_room', peer_id: 'alice_5', room_id: 'room_5' }));
  await getNextMessage(wsAlice);

  const aliceJoinPromise = getNextMessage(wsAlice);
  const bobJoinPromise = getNextMessage(wsBob);
  wsBob.send(JSON.stringify({ type: 'join_room', peer_id: 'bob_5', room_id: 'room_5' }));
  await Promise.all([aliceJoinPromise, bobJoinPromise]);

  const aliceLeaveNotifyPromise = getNextMessage(wsAlice);
  wsBob.send(JSON.stringify({
    type: 'leave_room',
    room_id: 'room_5',
    peer_id: 'bob_5'
  }));

  const notifyLeft = await aliceLeaveNotifyPromise;
  assert.strictEqual(notifyLeft.type, 'peer_left');
  assert.strictEqual(notifyLeft.peer_id, 'bob_5');

  wsAlice.terminate();
  wsBob.terminate();
  await delay();
});

test('6. Basic Validation (Error Handling)', async () => {
  const wsClient = await createClient();

  // Test malformed JSON
  const err1Promise = getNextMessage(wsClient);
  wsClient.send('INVALID_NON_JSON_STRING');
  let err = await err1Promise;
  assert.strictEqual(err.type, 'error');
  assert.strictEqual(err.code, 'INVALID_JSON');

  // Test missing type
  const err2Promise = getNextMessage(wsClient);
  wsClient.send(JSON.stringify({ room_id: 'room_err' }));
  err = await err2Promise;
  assert.strictEqual(err.type, 'error');
  assert.strictEqual(err.code, 'MISSING_TYPE');

  // Test non-existent room join
  const err3Promise = getNextMessage(wsClient);
  wsClient.send(JSON.stringify({ type: 'join_room', peer_id: 'p1', room_id: 'non_existent_room_999' }));
  err = await err3Promise;
  assert.strictEqual(err.type, 'error');
  assert.strictEqual(err.code, 'ROOM_NOT_FOUND');

  wsClient.terminate();
  await delay();
});
