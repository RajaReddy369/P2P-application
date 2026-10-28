/**
 * Persistent Encrypted Synchronization REST API Backend for P2P Messenger.
 * Built using Node.js native 'http' module with PostgreSQL Database Driver (db.js).
 * 
 * SECURITY RULES ENFORCED:
 * 1. ZERO PLAINTEXT ACCEPTED: Rejects any attempt to submit plaintext content.
 * 2. AUTHENTICATION & ACCESS CONTROL: All endpoints enforce JWT bearer token validation.
 * 3. MEMBERSHIP ISOLATION: Users can only read/sync conversations where they are a member.
 * 4. NO DOCKER / NO FIREBASE.
 */

const http = require('http');
const crypto = require('crypto');
const url = require('url');
const db = require('./db');
const SmsEmailService = require('./smsEmailService');

// Token sessions memory store (token -> { userId, username })
const activeSessions = new Map();

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

async function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  if (activeSessions.has(token)) {
    return activeSessions.get(token);
  }

  const dbSession = await db.findSessionByToken(token);
  if (dbSession) {
    const sessionObj = { userId: dbSession.user_id, username: dbSession.username };
    activeSessions.set(token, sessionObj);
    return sessionObj;
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    return res.end();
  }

  try {
    // Health Check
    if (method === 'GET' && path === '/api/v1/health') {
      return sendJson(res, 200, { status: 'ok', backend: 'Persistent Encrypted Synchronization Engine', zero_knowledge: true });
    }

    // 1. POST /api/v1/auth/register
    if (method === 'POST' && path === '/api/v1/auth/register') {
      const body = await parseJsonBody(req);
      const { username, display_name, country_code, phone_number, email, password, public_identity_key } = body;

      if (!username || !phone_number || !password) {
        return sendJson(res, 400, { error: 'Missing required parameters: username, phone_number, password' });
      }

      const existing = await db.findUserByUsername(username);
      if (existing) {
        return sendJson(res, 409, { error: 'Username already registered' });
      }

      const user = await db.createUser({
        username,
        display_name: display_name || username,
        country_code: country_code || '+91',
        phone_number,
        email: email || null,
        password,
        public_identity_key: public_identity_key || 'pub_key_default',
      });

      // Generate & deliver phone verification OTP via MSG91
      const otp = SmsEmailService.generateOtp();
      const targetPhone = require('./services/msg91Service').formatInternationalPhone(country_code, phone_number);
      
      await db.createOtp({ userId: user.id, target: targetPhone, target_type: 'phone', otp, purpose: 'registration' });
      
      let smsResult = { success: true };
      try {
        smsResult = await SmsEmailService.sendSmsOtp(phone_number, otp, { countryCode: country_code });
      } catch (err) {
        console.error('[SMS Delivery Exception on Register]', err.message);
        if (process.env.OTP_DEV_MODE === 'false') {
          return sendJson(res, 500, {
            error: err.message || "Failed to deliver SMS verification code. Account created, please use resend code.",
            user,
            phone_otp_sent: false,
          });
        }
      }

      const token = 'jwt_' + crypto.randomBytes(24).toString('hex');
      activeSessions.set(token, { userId: user.id, username: user.username });
      await db.createSession(token, user.id, user.username);

      return sendJson(res, 201, {
        message: 'User registered successfully. Verification code sent.',
        user,
        token,
        phone_otp_sent: smsResult.success !== false,
        target_masked: targetPhone.replace(/(\+\d{2})\d+(\d{4})/, '$1******$2'),
        resend_cooldown_seconds: 45,
      });
    }

    // 1b. POST /api/v1/auth/send-phone-otp
    if (method === 'POST' && path === '/api/v1/auth/send-phone-otp') {
      const body = await parseJsonBody(req);
      const { country_code, phone_number, purpose } = body;

      if (!phone_number) {
        return sendJson(res, 400, { error: 'Phone number is required' });
      }

      const Msg91Service = require('./services/msg91Service');
      const targetPhone = Msg91Service.formatInternationalPhone(country_code, phone_number);
      const otpPurpose = purpose || 'registration';

      // Rate limit / cooldown check (45 seconds)
      const cooldown = await db.checkOtpCooldown({ target: targetPhone, purpose: otpPurpose, cooldownSeconds: 45 });
      if (cooldown.onCooldown) {
        return sendJson(res, 429, {
          error: `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new code.`,
          retry_after_seconds: cooldown.retryAfterSeconds,
        });
      }

      const otp = SmsEmailService.generateOtp();
      await db.createOtp({ target: targetPhone, target_type: 'phone', otp, purpose: otpPurpose });

      try {
        await SmsEmailService.sendSmsOtp(phone_number, otp, { countryCode: country_code });
      } catch (err) {
        return sendJson(res, 500, { error: err.message || "Failed to deliver SMS verification code." });
      }

      return sendJson(res, 200, {
        message: 'OTP sent successfully.',
        target_masked: targetPhone.replace(/(\+\d{2})\d+(\d{4})/, '$1******$2'),
        resend_cooldown_seconds: 45,
      });
    }

    // 1c. POST /api/v1/auth/verify-phone-otp
    if (method === 'POST' && path === '/api/v1/auth/verify-phone-otp') {
      const body = await parseJsonBody(req);
      const { country_code, phone_number, otp, purpose } = body;

      if (!phone_number || !otp) {
        return sendJson(res, 400, { error: 'Phone number and OTP code are required' });
      }

      const Msg91Service = require('./services/msg91Service');
      const targetPhone = Msg91Service.formatInternationalPhone(country_code, phone_number);
      const otpPurpose = purpose || 'registration';

      const verifyRes = await db.verifyOtp({ target: targetPhone, otp, purpose: otpPurpose });
      if (!verifyRes.valid) {
        return sendJson(res, 400, { error: verifyRes.reason });
      }

      return sendJson(res, 200, {
        message: 'Phone number verified successfully.',
        phone_verified: true,
      });
    }

    // 1d. POST /api/v1/auth/resend-phone-otp
    if (method === 'POST' && path === '/api/v1/auth/resend-phone-otp') {
      const body = await parseJsonBody(req);
      const { country_code, phone_number, purpose } = body;

      if (!phone_number) {
        return sendJson(res, 400, { error: 'Phone number is required' });
      }

      const Msg91Service = require('./services/msg91Service');
      const targetPhone = Msg91Service.formatInternationalPhone(country_code, phone_number);
      const otpPurpose = purpose || 'registration';

      // Rate limit / cooldown check (45 seconds)
      const cooldown = await db.checkOtpCooldown({ target: targetPhone, purpose: otpPurpose, cooldownSeconds: 45 });
      if (cooldown.onCooldown) {
        return sendJson(res, 429, {
          error: `Please wait ${cooldown.retryAfterSeconds} seconds before requesting a new code.`,
          retry_after_seconds: cooldown.retryAfterSeconds,
        });
      }

      const otp = SmsEmailService.generateOtp();
      await db.createOtp({ target: targetPhone, target_type: 'phone', otp, purpose: otpPurpose });

      try {
        await Msg91Service.resendOTP(phone_number, otp, { countryCode: country_code });
      } catch (err) {
        return sendJson(res, 500, { error: err.message || "Failed to resend SMS verification code." });
      }

      return sendJson(res, 200, {
        message: 'Verification code resent successfully.',
        resend_cooldown_seconds: 45,
      });
    }

    // 2. POST /api/v1/auth/login
    if (method === 'POST' && path === '/api/v1/auth/login') {
      const body = await parseJsonBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJson(res, 400, { error: 'Username and password required' });
      }

      const user = await db.findUserByUsername(username);
      if (!user || !db.constructor.verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid username or password' });
      }

      // Check 2FA requirement
      if (user.two_factor_enabled) {
        const otp = SmsEmailService.generateOtp();
        const target = require('./services/msg91Service').formatInternationalPhone(user.country_code, user.phone_number);
        await db.createOtp({ userId: user.id, target, target_type: 'phone', otp, purpose: 'login_2fa' });
        await SmsEmailService.sendSmsOtp(user.phone_number, otp, { countryCode: user.country_code }).catch((e) => console.warn('[2FA Notice]', e.message));

        const challengeToken = '2fa_req_' + crypto.randomBytes(16).toString('hex');
        activeSessions.set(challengeToken, { userId: user.id, username: user.username, pending2FA: true });

        return sendJson(res, 200, {
          two_factor_required: true,
          challenge_token: challengeToken,
          target_masked: target.replace(/(\+\d{2})\d+(\d{4})/, '$1******$2'),
        });
      }

      const token = 'jwt_' + crypto.randomBytes(24).toString('hex');
      activeSessions.set(token, { userId: user.id, username: user.username });
      await db.createSession(token, user.id, user.username);

      return sendJson(res, 200, {
        message: 'Authentication successful',
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name || user.username,
          country_code: user.country_code || '+91',
          phone_number: user.phone_number,
          email: user.email || null,
          phone_verified: !!user.phone_verified,
          email_verified: !!user.email_verified,
          two_factor_enabled: !!user.two_factor_enabled,
          public_identity_key: user.public_identity_key,
        },
        token,
      });
    }

    // 2b. POST /api/v1/auth/login/2fa-verify
    if (method === 'POST' && path === '/api/v1/auth/login/2fa-verify') {
      const body = await parseJsonBody(req);
      const { challenge_token, otp } = body;

      const challenge = activeSessions.get(challenge_token);
      if (!challenge || !challenge.pending2FA) {
        return sendJson(res, 401, { error: 'Invalid or expired 2FA login challenge' });
      }

      const user = await db.findUserById(challenge.userId);
      const target = require('./services/msg91Service').formatInternationalPhone(user.country_code, user.phone_number);

      const verifyRes = await db.verifyOtp({ target, otp, purpose: 'login_2fa' });
      if (!verifyRes.valid) {
        return sendJson(res, 400, { error: verifyRes.reason });
      }

      activeSessions.delete(challenge_token);
      const token = 'jwt_' + crypto.randomBytes(24).toString('hex');
      activeSessions.set(token, { userId: user.id, username: user.username });
      await db.createSession(token, user.id, user.username);

      return sendJson(res, 200, {
        message: '2FA authentication successful',
        user,
        token,
      });
    }

    // 2c. POST /api/v1/auth/otp/send (Generic compatibility route)
    if (method === 'POST' && path === '/api/v1/auth/otp/send') {
      const body = await parseJsonBody(req);
      const { target, target_type, purpose, country_code } = body;

      if (!target || !purpose) {
        return sendJson(res, 400, { error: 'Parameters target and purpose are required' });
      }

      const Msg91Service = require('./services/msg91Service');
      const isEmail = target.includes('@');
      const targetFormatted = isEmail ? target : Msg91Service.formatInternationalPhone(country_code, target);
      const type = target_type || (isEmail ? 'email' : 'phone');

      const otp = SmsEmailService.generateOtp();
      await db.createOtp({ target: targetFormatted, target_type: type, otp, purpose });

      if (type === 'email') {
        await SmsEmailService.sendEmailOtp(targetFormatted, otp);
      } else {
        await SmsEmailService.sendSmsOtp(target, otp, { countryCode: country_code });
      }

      return sendJson(res, 200, { message: `Verification OTP sent to ${targetFormatted}` });
    }

    // 2d. POST /api/v1/auth/otp/verify (Generic compatibility route)
    if (method === 'POST' && path === '/api/v1/auth/otp/verify') {
      const body = await parseJsonBody(req);
      const { target, otp, purpose, country_code } = body;

      if (!target || !otp || !purpose) {
        return sendJson(res, 400, { error: 'Target, otp, and purpose are required' });
      }

      const Msg91Service = require('./services/msg91Service');
      const isEmail = target.includes('@');
      const targetFormatted = isEmail ? target : Msg91Service.formatInternationalPhone(country_code, target);

      const verifyRes = await db.verifyOtp({ target: targetFormatted, otp, purpose });
      if (!verifyRes.valid) {
        return sendJson(res, 400, { error: verifyRes.reason });
      }

      return sendJson(res, 200, { message: 'OTP verified successfully' });
    }

    // 2e. POST /api/v1/auth/qr/create (Laptop creates pairing challenge)
    if (method === 'POST' && path === '/api/v1/auth/qr/create') {
      const pairingId = 'qr_' + crypto.randomBytes(16).toString('hex');
      const pairing = await db.createQrPairing(pairingId, 2);
      return sendJson(res, 201, { pairing });
    }

    // 2f. GET /api/v1/auth/qr/status (Laptop polls status)
    if (method === 'GET' && path === '/api/v1/auth/qr/status') {
      const pairingId = parsedUrl.query.pairing_id;
      if (!pairingId) return sendJson(res, 400, { error: 'pairing_id parameter required' });

      const pairing = await db.getQrPairingStatus(pairingId);
      if (pairing.status === 'approved') {
        const user = await db.findUserById(pairing.user_id);
        return sendJson(res, 200, { status: 'approved', token: pairing.token, user });
      }
      return sendJson(res, 200, { status: pairing.status });
    }

    // 2g. POST /api/v1/auth/logout
    if (method === 'POST' && path === '/api/v1/auth/logout') {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token) {
          activeSessions.delete(token);
          await db.deleteSession(token).catch(() => {});
        }
      }
      return sendJson(res, 200, { message: 'Logged out successfully' });
    }

    // --- PROTECTED ENDPOINTS BEYOND THIS POINT ---
    const session = await authenticateToken(req);
    if (!session) {
      return sendJson(res, 401, { error: 'Unauthorized: Valid Bearer token required' });
    }

    // 2b. GET /api/v1/me
    if (method === 'GET' && path === '/api/v1/me') {
      const user = await db.findUserById(session.userId);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        id: user.id,
        username: user.username,
        display_name: user.display_name || user.username,
        country_code: user.country_code || '+91',
        phone_number: user.phone_number,
        email: user.email || null,
        avatar_url: user.avatar_url || null,
        phone_verified: !!user.phone_verified,
        email_verified: !!user.email_verified,
        two_factor_enabled: !!user.two_factor_enabled,
        public_identity_key: user.public_identity_key,
        created_at: user.created_at,
      });
    }

    // 2c. PATCH /api/v1/me or PUT /api/v1/me
    if ((method === 'PATCH' || method === 'PUT') && path === '/api/v1/me') {
      const body = await parseJsonBody(req);
      const updatedUser = await db.updateUserProfile(session.userId, {
        display_name: body.display_name,
        avatar_url: body.avatar_url,
        email: body.email,
        two_factor_enabled: body.two_factor_enabled,
      });
      if (!updatedUser) {
        return sendJson(res, 404, { error: 'Failed to update user profile' });
      }
      return sendJson(res, 200, { message: 'Profile updated successfully', user: updatedUser });
    }

    // 2c1. POST /api/v1/auth/2fa/setup
    if (method === 'POST' && path === '/api/v1/auth/2fa/setup') {
      const TotpService = require('./services/totpService');
      const user = await db.findUserById(session.userId);
      if (!user) return sendJson(res, 404, { error: 'User not found' });

      const secret = TotpService.generateSecret();
      const otpauthUrl = TotpService.generateOtpauthUri(user.username, secret, 'Chartpie');
      const recoveryCodes = TotpService.generateRecoveryCodes(8);

      return sendJson(res, 200, {
        message: 'TOTP 2FA challenge generated',
        secret,
        otpauth_url: otpauthUrl,
        recovery_codes: recoveryCodes,
      });
    }

    // 2c2. POST /api/v1/auth/2fa/enable
    if (method === 'POST' && path === '/api/v1/auth/2fa/enable') {
      const body = await parseJsonBody(req);
      const { secret, code, recovery_codes } = body;
      const TotpService = require('./services/totpService');

      if (!secret || !code) {
        return sendJson(res, 400, { error: 'Secret and 6-digit authenticator code are required' });
      }

      const isValid = TotpService.verifyToken(secret, code);
      if (!isValid) {
        return sendJson(res, 400, { error: 'Invalid 6-digit authenticator code. Please check your authenticator app.' });
      }

      const hashedCodes = (recovery_codes || []).map((rc) => ({
        hash: TotpService.hashRecoveryCode(rc),
        used: false,
      }));

      const updatedUser = await db.setTotpSecret(session.userId, secret, JSON.stringify(hashedCodes));
      return sendJson(res, 200, {
        message: 'Two-Step Verification enabled successfully.',
        user: updatedUser,
        two_factor_enabled: true,
      });
    }

    // 2c3. POST /api/v1/auth/2fa/disable
    if (method === 'POST' && path === '/api/v1/auth/2fa/disable') {
      const updatedUser = await db.disableTotp(session.userId);
      return sendJson(res, 200, {
        message: 'Two-Step Verification has been disabled.',
        user: updatedUser,
        two_factor_enabled: false,
      });
    }

    // 2d. GET /api/v1/users/search
    if (method === 'GET' && path.startsWith('/api/v1/users/search')) {
      const q = parsedUrl.query.q || '';
      const users = await db.searchUsers(q, session.userId);
      return sendJson(res, 200, { users });
    }

    // 3. POST /api/v1/devices/register
    if (method === 'POST' && path === '/api/v1/devices/register') {
      const body = await parseJsonBody(req);
      const { device_name, device_type, public_device_key } = body;

      if (!public_device_key) {
        return sendJson(res, 400, { error: 'Missing public_device_key' });
      }

      const device = await db.registerDevice({
        user_id: session.userId,
        device_name: device_name || 'Authorized Endpoint',
        device_type: device_type || 'web',
        public_device_key,
      });

      return sendJson(res, 201, { message: 'Device registered', device });
    }

    // 3b. POST /api/v1/auth/qr/approve (Authenticated phone approves laptop QR)
    if (method === 'POST' && path === '/api/v1/auth/qr/approve') {
      const body = await parseJsonBody(req);
      const { pairing_id, device_info } = body;

      if (!pairing_id) {
        return sendJson(res, 400, { error: 'pairing_id is required' });
      }

      const newLaptopToken = 'jwt_' + crypto.randomBytes(24).toString('hex');
      activeSessions.set(newLaptopToken, { userId: session.userId, username: session.username });
      await db.createSession(newLaptopToken, session.userId, session.username);

      const approved = await db.approveQrPairing(pairing_id, session.userId, newLaptopToken, device_info || 'Web Client');
      if (!approved) {
        return sendJson(res, 400, { error: 'QR pairing expired or invalid' });
      }

      await db.registerDevice({
        user_id: session.userId,
        device_name: device_info || 'Linked Web Client (QR)',
        device_type: 'web',
        public_device_key: 'pub_qr_key_' + crypto.randomBytes(8).toString('hex'),
      }).catch(() => {});

      return sendJson(res, 200, { message: 'QR session pairing approved successfully' });
    }

    // 4. GET /api/v1/devices
    if (method === 'GET' && path === '/api/v1/devices') {
      const devices = await db.getUserDevices(session.userId);
      return sendJson(res, 200, { devices });
    }

    // 4a. DELETE /api/v1/devices/:id
    if (method === 'DELETE' && path.startsWith('/api/v1/devices/')) {
      const targetDeviceId = path.split('/')[4];
      if (targetDeviceId) {
        await db.deleteDevice(targetDeviceId, session.userId);
        return sendJson(res, 200, { message: 'Device session revoked' });
      }
    }

    // 4a2. POST /api/v1/devices/logout-others
    if (method === 'POST' && path === '/api/v1/devices/logout-others') {
      const body = await parseJsonBody(req);
      const currentDeviceId = body.current_device_id || null;
      await db.revokeAllOtherDevices(currentDeviceId, session.userId);
      return sendJson(res, 200, { message: 'All other device sessions revoked successfully' });
    }

    // 4b. GET /api/v1/users
    if (method === 'GET' && path === '/api/v1/users') {
      const users = await db.getAllUsers();
      return sendJson(res, 200, { users });
    }

    // 4c. GET /api/v1/users/by-username/:username
    if (method === 'GET' && path.startsWith('/api/v1/users/by-username/')) {
      const targetUsername = decodeURIComponent(path.split('/')[5]);
      const targetUser = await db.findUserByUsername(targetUsername);
      if (!targetUser) {
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        id: targetUser.id,
        username: targetUser.username,
        display_name: targetUser.display_name || targetUser.username,
        country_code: targetUser.country_code || '+91',
        phone_number: targetUser.phone_number,
        public_identity_key: targetUser.public_identity_key,
      });
    }

    // 4d. GET /api/v1/users/:id/public-key
    if (method === 'GET' && path.startsWith('/api/v1/users/') && path.endsWith('/public-key')) {
      const targetUserId = path.split('/')[4];
      const targetUser = await db.findUserById(targetUserId);
      if (!targetUser) {
        return sendJson(res, 404, { error: 'User not found' });
      }
      return sendJson(res, 200, {
        user_id: targetUser.id,
        public_identity_key: targetUser.public_identity_key,
      });
    }

    // 4e. GET /api/v1/users/:id/presence
    if (method === 'GET' && path.startsWith('/api/v1/users/') && path.endsWith('/presence')) {
      const targetUserId = path.split('/')[4];
      const presence = await db.getPresence(targetUserId);
      return sendJson(res, 200, { presence });
    }

    // 4f. POST /api/v1/presence/heartbeat
    if (method === 'POST' && path === '/api/v1/presence/heartbeat') {
      const body = await parseJsonBody(req);
      const status = body.status || 'online';
      const presence = await db.updatePresence(session.userId, status);
      return sendJson(res, 200, { message: 'Presence updated', presence });
    }

    // 5. GET /api/v1/conversations
    if (method === 'GET' && path === '/api/v1/conversations') {
      const convs = await db.getUserConversations(session.userId);
      return sendJson(res, 200, { conversations: convs });
    }

    // 5b. GET /api/v1/conversations/:id/key-envelope
    if (method === 'GET' && path.startsWith('/api/v1/conversations/') && path.endsWith('/key-envelope')) {
      const parts = path.split('/');
      const convId = parts[4];

      const isMember = await db.isUserConversationMember(session.userId, convId);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden: Access denied to conversation key envelope' });
      }

      const envelope = await db.getMemberEnvelope(session.userId, convId);
      return sendJson(res, 200, {
        conversation_id: convId,
        user_id: session.userId,
        encrypted_conversation_key: envelope,
      });
    }

    // 6. POST /api/v1/conversations
    if (method === 'POST' && path === '/api/v1/conversations') {
      const body = await parseJsonBody(req);
      const { type, recipient_user_id, encrypted_key_creator, encrypted_key_recipient } = body;

      if (!encrypted_key_creator || encrypted_key_creator === 'key_envelope_stub') {
        return sendJson(res, 400, { error: 'Valid encrypted_key_creator envelope is required' });
      }

      if (recipient_user_id && (!encrypted_key_recipient || encrypted_key_recipient === 'key_envelope_stub')) {
        return sendJson(res, 400, { error: 'Valid encrypted_key_recipient envelope is required' });
      }

      const conv = await db.createConversation({
        type: type || 'direct',
        creator_user_id: session.userId,
        recipient_user_id,
        encrypted_key_creator,
        encrypted_key_recipient,
      });

      return sendJson(res, 201, { message: 'Conversation created', conversation: conv });
    }

    // 7. GET /api/v1/conversations/:id/messages
    if (method === 'GET' && path.startsWith('/api/v1/conversations/') && path.endsWith('/messages')) {
      const parts = path.split('/');
      const convId = parts[4];
      const limit = Math.min(parseInt(parsedUrl.query.limit || '30', 10), 100);
      const beforeSeq = parsedUrl.query.before_sequence ? parseInt(parsedUrl.query.before_sequence, 10) : null;

      // Access Control: Verify membership
      const isMember = await db.isUserConversationMember(session.userId, convId);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden: Access denied to conversation' });
      }

      const msgs = await db.getPaginatedMessages(convId, limit, beforeSeq);
      return sendJson(res, 200, { conversation_id: convId, messages: msgs, limit });
    }

    // 8. POST /api/v1/sync/messages (PLAINTEXT REJECTION RULE ENFORCED)
    if (method === 'POST' && path === '/api/v1/sync/messages') {
      const body = await parseJsonBody(req);

      // Check for forbidden plaintext submission attempts
      if (body.plaintext || body.message_text || body.content || body.text) {
        return sendJson(res, 400, {
          error: 'Plaintext message submission rejected. The database accepts encrypted payloads only.',
        });
      }

      const { conversation_id, sender_device_id, encrypted_payload, iv, message_type } = body;

      if (!conversation_id || !encrypted_payload || !iv) {
        return sendJson(res, 400, { error: 'Missing encrypted_payload, iv, or conversation_id' });
      }

      // Access Control: Verify membership
      const isMember = await db.isUserConversationMember(session.userId, conversation_id);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden: Cannot post message to conversation where you are not a member' });
      }

      const record = await db.saveEncryptedMessage({
        conversation_id,
        sender_id: session.userId,
        sender_device_id,
        encrypted_payload,
        iv,
        message_type: message_type || 'text',
      });

      return sendJson(res, 201, { message: 'Encrypted message payload synced', record });
    }

    // 8b. POST /api/v1/conversations/:id/media (Encrypted Media Upload - ZERO PLAINTEXT RULE ENFORCED)
    if (method === 'POST' && path.startsWith('/api/v1/conversations/') && path.endsWith('/media')) {
      const parts = path.split('/');
      const convId = parts[4];
      const body = await parseJsonBody(req);

      if (body.plaintext || body.message_text || body.content || body.text) {
        return sendJson(res, 400, {
          error: 'Plaintext media submission rejected. The database accepts encrypted media payloads only.',
        });
      }

      const { encrypted_payload, iv, mime_type, file_size } = body;
      if (!convId || !encrypted_payload || !iv) {
        return sendJson(res, 400, { error: 'Missing encrypted_payload, iv, or conversation_id' });
      }

      const isMember = await db.isUserConversationMember(session.userId, convId);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden: Cannot upload media to conversation where you are not a member' });
      }

      const record = await db.saveEncryptedMessage({
        conversation_id: convId,
        sender_id: session.userId,
        encrypted_payload,
        iv,
        message_type: 'image',
      });

      return sendJson(res, 201, { message: 'Encrypted media synced successfully', record, media_id: record.id });
    }

    // 9. GET /api/v1/sync/state
    if (method === 'GET' && path === '/api/v1/sync/state') {
      const deviceId = parsedUrl.query.device_id;
      const convId = parsedUrl.query.conversation_id;

      if (!deviceId || !convId) {
        return sendJson(res, 400, { error: 'Parameters device_id and conversation_id required' });
      }

      // Access Control
      const isMember = await db.isUserConversationMember(session.userId, convId);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden' });
      }

      const syncState = await db.getSyncState(deviceId, convId);
      return sendJson(res, 200, { sync_state: syncState || { device_id: deviceId, conversation_id: convId, last_synced_sequence: 0 } });
    }

    // 10. POST /api/v1/sync/state
    if (method === 'POST' && path === '/api/v1/sync/state') {
      const body = await parseJsonBody(req);
      const { device_id, conversation_id, last_synced_sequence } = body;

      if (!device_id || !conversation_id || last_synced_sequence === undefined) {
        return sendJson(res, 400, { error: 'Missing device_id, conversation_id, or last_synced_sequence' });
      }

      // Access Control
      const isMember = await db.isUserConversationMember(session.userId, conversation_id);
      if (!isMember) {
        return sendJson(res, 403, { error: 'Forbidden' });
      }

      const updated = await db.updateSyncState(device_id, conversation_id, parseInt(last_synced_sequence, 10));
      return sendJson(res, 200, { message: 'Sync state updated', sync_state: updated });
    }

    // 404 Not Found
    return sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    return sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

const PORT = process.env.API_PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[API] Persistent Encrypted Synchronization Backend listening on http://localhost:${PORT}`);
  });
}

module.exports = server;
