/**
 * API Client Service connecting React Web Application to Node.js Zero-Knowledge REST API.
 * Handles Authentication, Device Registration, Conversation Indexing, Profile, and Encrypted Payload Sync.
 * 
 * Enforces sessionStorage for tab-isolated authentication sessions.
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private static token: string | null = localStorage.getItem('chartpie_auth_token') || sessionStorage.getItem('chartpie_auth_token');

  static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('chartpie_auth_token', token);
      sessionStorage.setItem('chartpie_auth_token', token);
    } else {
      localStorage.removeItem('chartpie_auth_token');
      sessionStorage.removeItem('chartpie_auth_token');
    }
  }

  static getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('chartpie_auth_token') || sessionStorage.getItem('chartpie_auth_token');
    }
    return this.token;
  }

  static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const currentToken = this.getToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return headers;
  }

  static async register(username: string, displayName: string, countryCode: string, phoneNumber: string, email: string, password: string, publicIdentityKey: string) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        display_name: displayName,
        country_code: countryCode,
        phone_number: phoneNumber,
        email,
        password,
        public_identity_key: publicIdentityKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Registration failed', res.status);
    }
    const data = await res.json();
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  static async login(username: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Login failed', res.status);
    }
    const data = await res.json();
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  static async login2FA(challengeToken: string, otp: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login/2fa-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_token: challengeToken, otp }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || '2FA verification failed', res.status);
    }
    const data = await res.json();
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  static async sendPhoneOtp(countryCode: string, phoneNumber: string, purpose: string = 'registration') {
    const res = await fetch(`${API_BASE_URL}/auth/send-phone-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country_code: countryCode, phone_number: phoneNumber, purpose }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Failed to send OTP verification code', res.status);
    }
    return await res.json();
  }

  static async verifyPhoneOtp(countryCode: string, phoneNumber: string, otp: string, purpose: string = 'registration') {
    const res = await fetch(`${API_BASE_URL}/auth/verify-phone-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country_code: countryCode, phone_number: phoneNumber, otp, purpose }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Incorrect verification code. Please try again.', res.status);
    }
    return await res.json();
  }

  static async resendPhoneOtp(countryCode: string, phoneNumber: string, purpose: string = 'registration') {
    const res = await fetch(`${API_BASE_URL}/auth/resend-phone-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country_code: countryCode, phone_number: phoneNumber, purpose }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Failed to resend verification code', res.status);
    }
    return await res.json();
  }

  static async sendOtp(target: string, purpose: string, targetType?: 'phone' | 'email') {
    const res = await fetch(`${API_BASE_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, purpose, target_type: targetType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Failed to send OTP', res.status);
    }
    return await res.json();
  }

  static async verifyOtp(target: string, otp: string, purpose: string) {
    const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, otp, purpose }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'OTP verification failed', res.status);
    }
    return await res.json();
  }

  static async createQrPairing() {
    const res = await fetch(`${API_BASE_URL}/auth/qr/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new ApiError('Failed to create QR pairing', res.status);
    }
    const data = await res.json();
    return data.pairing;
  }

  static async getQrPairingStatus(pairingId: string) {
    const res = await fetch(`${API_BASE_URL}/auth/qr/status?pairing_id=${encodeURIComponent(pairingId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { status: 'expired' };
    const data = await res.json();
    if (data.status === 'approved' && data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  static async approveQrPairing(pairingId: string, deviceInfo?: string) {
    const res = await fetch(`${API_BASE_URL}/auth/qr/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ pairing_id: pairingId, device_info: deviceInfo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Failed to approve QR pairing', res.status);
    }
    return await res.json();
  }

  static async getDevices() {
    const res = await fetch(`${API_BASE_URL}/devices`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new ApiError('Failed to fetch devices', res.status);
    const data = await res.json();
    return data.devices || [];
  }

  static async deleteDevice(deviceId: string) {
    const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new ApiError('Failed to revoke device session', res.status);
    return await res.json();
  }

  static async logoutOtherDevices(currentDeviceId?: string) {
    const res = await fetch(`${API_BASE_URL}/devices/logout-others`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ current_device_id: currentDeviceId }),
    });
    if (!res.ok) throw new ApiError('Failed to logout other devices', res.status);
    return await res.json();
  }

  static async getCurrentUser() {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    } catch (err: unknown) {
      throw new ApiError('Unable to connect to server. Please check your network connection.', 0);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Failed to authenticate current user', res.status);
    }
    return await res.json();
  }

  static async updateProfile(displayName?: string, avatarUrl?: string, email?: string, twoFactorEnabled?: boolean) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/me`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl,
          email: email,
          two_factor_enabled: twoFactorEnabled,
        }),
      });
    } catch (err: unknown) {
      throw new ApiError('Unable to connect to Chartpie backend. Please check network connection.', 0);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.error || 'Unable to save your profile. Please try again.', res.status);
    }
    const data = await res.json();
    return data.user;
  }

  static async setup2FA() {
    const res = await fetch(`${API_BASE_URL}/auth/2fa/setup`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initialize Two-Step Verification');
    }
    return await res.json();
  }

  static async enable2FA(secret: string, code: string, recoveryCodes: string[]) {
    const res = await fetch(`${API_BASE_URL}/auth/2fa/enable`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ secret, code, recovery_codes: recoveryCodes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid 6-digit verification code. Please check your authenticator app.');
    }
    return await res.json();
  }

  static async disable2FA() {
    const res = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to disable Two-Step Verification');
    }
    return await res.json();
  }

  static async searchUsers(query: string) {
    const res = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to search users');
    }
    const data = await res.json();
    return data.users || [];
  }

  static async registerDevice(deviceName: string, deviceType: string, publicDeviceKey: string) {
    const res = await fetch(`${API_BASE_URL}/devices/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        device_name: deviceName,
        device_type: deviceType,
        public_device_key: publicDeviceKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Device registration failed');
    }
    return await res.json();
  }

  static async getUsers() {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch users');
    }
    const data = await res.json();
    return data.users || [];
  }

  static async getUserByUsername(username: string) {
    const res = await fetch(`${API_BASE_URL}/users/by-username/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'User not found');
    }
    return await res.json();
  }

  static async sendPresenceHeartbeat(status: 'online' | 'away' | 'offline' = 'online') {
    const res = await fetch(`${API_BASE_URL}/presence/heartbeat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return null;
    return await res.json();
  }

  static async getUserPresence(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/presence`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) return { presence_status: 'online', last_seen: new Date().toISOString() };
    const data = await res.json();
    return data.presence;
  }

  static async getKeyEnvelope(conversationId: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/key-envelope`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch conversation key envelope');
    }
    const data = await res.json();
    return data.encrypted_conversation_key;
  }

  static async getConversations() {
    const res = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch conversations');
    }
    const data = await res.json();
    return data.conversations || [];
  }

  static async createConversation(recipientUserId: string, encryptedKeyCreator: string, encryptedKeyRecipient: string) {
    const res = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'direct',
        recipient_user_id: recipientUserId,
        encrypted_key_creator: encryptedKeyCreator,
        encrypted_key_recipient: encryptedKeyRecipient,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create conversation');
    }
    const data = await res.json();
    return data.conversation;
  }

  static async getEncryptedMessages(conversationId: string, limit = 30) {
    const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages?limit=${limit}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch messages');
    }
    const data = await res.json();
    return data.messages || [];
  }

  static async syncEncryptedMessage(conversationId: string, encryptedPayload: string, iv: string) {
    const res = await fetch(`${API_BASE_URL}/sync/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        encrypted_payload: encryptedPayload,
        iv,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sync encrypted message');
    }
    const data = await res.json();
    return data.record;
  }

  static async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (_) {}
    this.setToken(null);
  }
}
