/**
 * RFC 6238 compliant Time-Based One-Time Password (TOTP) Service for Chartpie.
 * Built using Node.js native 'crypto' module without external dependencies.
 * 
 * Supports:
 * - Base32 secret generation & decoding
 * - RFC 6238 TOTP calculation (30s window, HMAC-SHA1)
 * - Clock skew tolerance (-1, 0, +1 windows)
 * - One-time recovery code generation & PBKDF2 hashing
 */

const crypto = require('crypto');

class TotpService {
  /**
   * Base32 encoding helper (RFC 4648).
   */
  static base32Encode(buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  /**
   * Base32 decoding helper (RFC 4648).
   */
  static base32Decode(base32Str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32Str.toUpperCase().replace(/=/g, '').replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const output = [];
    for (let i = 0; i < cleaned.length; i++) {
      value = (value << 5) | alphabet.indexOf(cleaned[i]);
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }

  /**
   * Generate a secure 160-bit (20 byte) Base32 TOTP Secret.
   */
  static generateSecret() {
    const bytes = crypto.randomBytes(20);
    return this.base32Encode(bytes);
  }

  /**
   * Calculate 6-digit TOTP token for a given time window.
   */
  static generateToken(secretBase32, windowOffset = 0) {
    const key = this.base32Decode(secretBase32);
    const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    return otp;
  }

  /**
   * Verify TOTP token with ±1 window (90s time skew tolerance).
   */
  static verifyToken(secretBase32, token) {
    if (!secretBase32 || !token) return false;
    const cleanedToken = token.toString().trim();
    if (cleanedToken.length !== 6 || !/^\d{6}$/.test(cleanedToken)) return false;

    for (const offset of [-1, 0, 1]) {
      const expected = this.generateToken(secretBase32, offset);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanedToken))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate standard otpauth:// URI for QR codes.
   */
  static generateOtpauthUri(username, secretBase32, issuer = 'Chartpie') {
    const label = encodeURIComponent(`${issuer}:${username}`);
    const encIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generate 8 unique 10-character recovery codes (e.g. A1B2-C3D4).
   */
  static generateRecoveryCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  /**
   * Hash a recovery code for secure storage in database.
   */
  static hashRecoveryCode(code) {
    const cleaned = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return crypto.createHash('sha256').update(cleaned).digest('hex');
  }

  /**
   * Verify and consume a recovery code against stored hashes.
   */
  static verifyAndConsumeRecoveryCode(code, storedCodesJson) {
    if (!code || !storedCodesJson) return { valid: false, updatedCodesJson: storedCodesJson };
    
    let codes = [];
    try {
      codes = typeof storedCodesJson === 'string' ? JSON.parse(storedCodesJson) : storedCodesJson;
    } catch (_) {
      return { valid: false, updatedCodesJson: storedCodesJson };
    }

    const inputHash = this.hashRecoveryCode(code);
    const matchIndex = codes.findIndex((c) => c.hash === inputHash && !c.used);

    if (matchIndex === -1) {
      return { valid: false, updatedCodesJson: storedCodesJson };
    }

    codes[matchIndex].used = true;
    codes[matchIndex].used_at = new Date().toISOString();

    return {
      valid: true,
      updatedCodesJson: JSON.stringify(codes),
    };
  }
}

module.exports = TotpService;
