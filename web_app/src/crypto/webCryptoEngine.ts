/**
 * Web Crypto API Engine (window.crypto.subtle) with IndexedDB Storage & Asymmetric Key Distribution.
 *
 * SECURITY & ARCHITECTURE DESIGN:
 * 1. Identity Key Pairs: Users generate ECDH P-256 identity key pairs for key agreement.
 * 2. Conversation Key Envelopes: Conversation creator generates a random 256-bit AES-GCM key
 *    and wraps it in encrypted envelopes using ephemeral ECDH + AES-GCM for each recipient.
 * 3. Non-Extractable Local Storage: Unwrapped conversation CryptoKey objects are stored
 *    in IndexedDB with extractable: false.
 * 4. Zero Plaintext/Key Leakage: Raw keys are never sent to backend or stored in DB/localStorage.
 * 5. Fresh IV per Message: Every AES-256-GCM message encryption uses a fresh 12-byte random IV.
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64 ciphertext + GCM auth tag
  iv: string;         // Base64 12-byte IV
}

export interface KeyEnvelope {
  version: string;
  ephemeralPublicKey: string; // Base64 SPKI ECDH public key
  encryptedKey: string;       // Base64 AES-GCM wrapped conversation key
  iv: string;                 // Base64 12-byte IV
}

export class WebCryptoEngine {
  private static DB_NAME = 'P2PMessengerKeyVault';
  private static DB_VERSION = 1;
  private static STORE_NAME = 'crypto_keys';

  /**
   * Opens or initializes the browser's IndexedDB Key Vault.
   */
  private static openKeyVault(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this browser. Non-extractable key storage requires IndexedDB.'));
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB key vault'));
    });
  }

  /**
   * Stores a CryptoKey object safely in IndexedDB.
   */
  static async storeKeyInVault(keyId: string, key: CryptoKey): Promise<void> {
    const db = await this.openKeyVault();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({ id: keyId, key, createdAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Failed to store key '${keyId}' in IndexedDB`));
    });
  }

  /**
   * Retrieves a stored CryptoKey object from IndexedDB.
   */
  static async loadKeyFromVault(keyId: string): Promise<CryptoKey | null> {
    const db = await this.openKeyVault();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(keyId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.key as CryptoKey) : null);
      };
      request.onerror = () => reject(request.error || new Error(`Failed to load key '${keyId}' from IndexedDB`));
    });
  }

  /**
   * Stores arbitrary metadata string/data in IndexedDB.
   */
  static async storeDataInVault(dataId: string, value: string): Promise<void> {
    const db = await this.openKeyVault();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({ id: dataId, value, createdAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Failed to store data '${dataId}' in IndexedDB`));
    });
  }

  /**
   * Retrieves stored metadata string/data from IndexedDB.
   */
  static async loadDataFromVault(dataId: string): Promise<string | null> {
    const db = await this.openKeyVault();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(dataId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.value as string) : null);
      };
      request.onerror = () => reject(request.error || new Error(`Failed to load data '${dataId}' from IndexedDB`));
    });
  }

  /**
   * Removes all stored keys from IndexedDB (used on logout or device revocation).
   */
  static async clearKeyVault(): Promise<void> {
    const db = await this.openKeyVault();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to clear key vault'));
    });
  }

  /**
   * Initializes or loads the user's asymmetric ECDH P-256 identity key pair.
   */
  static async initializeIdentityKeyPair(userId: string = 'current_user'): Promise<{ publicKeyBase64: string; privateKey: CryptoKey }> {
    const privKeyId = `id_priv_key_${userId}`;
    const pubKeyId = `id_pub_key_${userId}`;

    const existingPrivKey = await this.loadKeyFromVault(privKeyId);
    const existingPubKeyBase64 = await this.loadDataFromVault(pubKeyId);

    if (existingPrivKey && existingPubKeyBase64) {
      return { publicKeyBase64: existingPubKeyBase64, privateKey: existingPrivKey };
    }

    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = this.uint8ArrayToBase64(new Uint8Array(spkiBuffer));

    await this.storeKeyInVault(privKeyId, keyPair.privateKey);
    await this.storeDataInVault(pubKeyId, publicKeyBase64);

    return { publicKeyBase64, privateKey: keyPair.privateKey };
  }

  /**
   * Generates a 256-bit AES-GCM conversation symmetric key.
   */
  static async generateConversationKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable temporarily so it can be wrapped into envelopes
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Creates an encrypted key envelope for a recipient using ephemeral ECDH + AES-GCM key wrapping.
   */
  static async createEncryptedKeyEnvelope(convKey: CryptoKey, recipientPublicKeyBase64: string): Promise<string> {
    const ephemeralKeyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const ephSpkiBuffer = await window.crypto.subtle.exportKey('spki', ephemeralKeyPair.publicKey);
    const ephemeralPublicKeyBase64 = this.uint8ArrayToBase64(new Uint8Array(ephSpkiBuffer));

    const recipientPubKeyBytes = this.base64ToUint8Array(recipientPublicKeyBase64);
    const recipientPubKey = await window.crypto.subtle.importKey(
      'spki',
      this.toArrayBuffer(recipientPubKeyBytes),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );

    const envelopeKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPubKey,
      },
      ephemeralKeyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['wrapKey']
    );

    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));

    const wrappedBuffer = await window.crypto.subtle.wrapKey(
      'raw',
      convKey,
      envelopeKey,
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(ivBytes),
      }
    );

    const envelope: KeyEnvelope = {
      version: '1.0',
      ephemeralPublicKey: ephemeralPublicKeyBase64,
      encryptedKey: this.uint8ArrayToBase64(new Uint8Array(wrappedBuffer)),
      iv: this.uint8ArrayToBase64(ivBytes),
    };

    return JSON.stringify(envelope);
  }

  /**
   * Unwraps an encrypted key envelope locally using the recipient's private identity key.
   * Restores the conversation key as a non-extractable CryptoKey.
   */
  static async unwrapKeyEnvelope(envelopeJson: string, recipientPrivateKey: CryptoKey): Promise<CryptoKey> {
    let envelope: KeyEnvelope;
    try {
      envelope = JSON.parse(envelopeJson);
    } catch (_) {
      throw new Error('Invalid key envelope JSON structure');
    }

    if (!envelope.ephemeralPublicKey || !envelope.encryptedKey || !envelope.iv) {
      throw new Error('Malformed key envelope payload missing required fields');
    }

    const ephPubKeyBytes = this.base64ToUint8Array(envelope.ephemeralPublicKey);
    const ephPubKey = await window.crypto.subtle.importKey(
      'spki',
      this.toArrayBuffer(ephPubKeyBytes),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );

    const envelopeKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: ephPubKey,
      },
      recipientPrivateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['unwrapKey']
    );

    const encryptedKeyBytes = this.base64ToUint8Array(envelope.encryptedKey);
    const ivBytes = this.base64ToUint8Array(envelope.iv);

    return window.crypto.subtle.unwrapKey(
      'raw',
      this.toArrayBuffer(encryptedKeyBytes),
      envelopeKey,
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(ivBytes),
      },
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non-extractable in recipient browser!
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Retrieves an authorized per-conversation key from IndexedDB or unwraps its encrypted envelope from backend.
   */
  static async getConversationKey(
    conversationId: string,
    envelopeFetcher?: () => Promise<string>,
    userId?: string
  ): Promise<CryptoKey> {
    const vaultKeyId = userId ? `user_${userId}_conv_${conversationId}` : `conv_key_${conversationId}`;
    const existingKey = await this.loadKeyFromVault(vaultKeyId);
    if (existingKey) {
      return existingKey;
    }

    if (!envelopeFetcher) {
      throw new Error(`Conversation key for '${conversationId}' is not available locally or on backend.`);
    }

    const envelopeJson = await envelopeFetcher();
    if (!envelopeJson || envelopeJson === 'key_envelope_stub') {
      throw new Error(`No valid encrypted key envelope found for conversation '${conversationId}'.`);
    }

    const { privateKey } = await this.initializeIdentityKeyPair(userId);
    const unwrappedKey = await this.unwrapKeyEnvelope(envelopeJson, privateKey);

    await this.storeKeyInVault(vaultKeyId, unwrappedKey);
    return unwrappedKey;
  }

  /**
   * Encrypts plaintext string using AES-256-GCM. Every call uses a fresh 12-byte random IV.
   */
  static async encryptMessage(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(plaintext);
    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(ivBytes),
      },
      key,
      this.toArrayBuffer(dataBuffer)
    );

    return {
      ciphertext: this.uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
      iv: this.uint8ArrayToBase64(ivBytes),
    };
  }

  /**
   * Decrypts AES-256-GCM ciphertext payload. Throws Error if MAC check fails or key is invalid.
   */
  static async decryptMessage(key: CryptoKey, ciphertextBase64: string, ivBase64: string): Promise<string> {
    const cipherTextBytes = this.base64ToUint8Array(ciphertextBase64);
    const ivBytes = this.base64ToUint8Array(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(ivBytes),
      },
      key,
      this.toArrayBuffer(cipherTextBytes)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Helper: Safely converts Uint8Array view to a clean ArrayBuffer type.
   */
  static toArrayBuffer(view: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(view.byteLength);
    new Uint8Array(buffer).set(view);
    return buffer;
  }

  /**
   * Helper: Converts Uint8Array bytes to Base64 string.
   */
  static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Converts Base64 string to Uint8Array bytes.
   */
  static base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

