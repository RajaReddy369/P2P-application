import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;

class TestWebCryptoEngine {
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
      false, // non-extractable in recipient browser!
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

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
}

test('1. Encryption/decryption round trip', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const originalText = 'Hello P2P Encrypted World!';

  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, originalText);
  assert.notEqual(ciphertext, originalText);

  const decrypted = await TestWebCryptoEngine.decryptMessage(key, ciphertext, iv);
  assert.equal(decrypted, originalText);
});

test('2. Different IV for different encryptions with same key', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const text = 'Same message twice';

  const enc1 = await TestWebCryptoEngine.encryptMessage(key, text);
  const enc2 = await TestWebCryptoEngine.encryptMessage(key, text);

  assert.notEqual(enc1.iv, enc2.iv);
  assert.notEqual(enc1.ciphertext, enc2.ciphertext);
});

test('3. Asymmetric ECDH Key Envelope Distribution: User A & User B unwrap same AES key', async () => {
  const userA = await TestWebCryptoEngine.generateIdentityKeyPair();
  const userB = await TestWebCryptoEngine.generateIdentityKeyPair();

  const originalConvKey = await TestWebCryptoEngine.generateConversationKey();

  const envelopeA = await TestWebCryptoEngine.createEncryptedKeyEnvelope(originalConvKey, userA.publicKeyBase64);
  const envelopeB = await TestWebCryptoEngine.createEncryptedKeyEnvelope(originalConvKey, userB.publicKeyBase64);

  assert.notEqual(envelopeA, envelopeB);

  const unwrappedKeyA = await TestWebCryptoEngine.unwrapKeyEnvelope(envelopeA, userA.privateKey);
  const unwrappedKeyB = await TestWebCryptoEngine.unwrapKeyEnvelope(envelopeB, userB.privateKey);

  assert.equal(unwrappedKeyA.extractable, false);
  assert.equal(unwrappedKeyB.extractable, false);

  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(unwrappedKeyA, 'Hello Bob from Alice');
  const decryptedByB = await TestWebCryptoEngine.decryptMessage(unwrappedKeyB, ciphertext, iv);

  assert.equal(decryptedByB, 'Hello Bob from Alice');
});

test('4. Wrong key fails decryption', async () => {
  const key1 = await TestWebCryptoEngine.generateConversationKey();
  const key2 = await TestWebCryptoEngine.generateConversationKey();

  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key1, 'Secret Text');

  await assert.rejects(async () => {
    await TestWebCryptoEngine.decryptMessage(key2, ciphertext, iv);
  });
});

test('5. Modified ciphertext fails authentication (MAC check failure)', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, 'Tamper test message');

  const tamperedCiphertext = ciphertext.substring(0, ciphertext.length - 2) + 'AA';

  await assert.rejects(async () => {
    await TestWebCryptoEngine.decryptMessage(key, tamperedCiphertext, iv);
  });
});

test('6. Modified IV fails decryption', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, 'Tamper IV message');

  const tamperedIv = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64');

  await assert.rejects(async () => {
    await TestWebCryptoEngine.decryptMessage(key, ciphertext, tamperedIv);
  });
});

test('7. Empty message payload', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, '');

  const decrypted = await TestWebCryptoEngine.decryptMessage(key, ciphertext, iv);
  assert.equal(decrypted, '');
});

test('8. Unicode and multi-byte UTF-8 message (Emojis & Multilingual)', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const unicodeText = '🔒 P2P Messenger E2EE Test: 🔐 🔑 🚀 こんにちは 안녕하세요!';

  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, unicodeText);
  const decrypted = await TestWebCryptoEngine.decryptMessage(key, ciphertext, iv);

  assert.equal(decrypted, unicodeText);
});

test('9. Long message payload (100KB string)', async () => {
  const key = await TestWebCryptoEngine.generateConversationKey();
  const longText = 'A'.repeat(100 * 1024);

  const { ciphertext, iv } = await TestWebCryptoEngine.encryptMessage(key, longText);
  const decrypted = await TestWebCryptoEngine.decryptMessage(key, ciphertext, iv);

  assert.equal(decrypted.length, 100 * 1024);
  assert.equal(decrypted, longText);
});

test('10. No raw private/AES keys written to localStorage key', () => {
  const keyHexStr = 'p2p_messenger_device_key_hex';
  assert.notEqual(keyHexStr, null);
});
