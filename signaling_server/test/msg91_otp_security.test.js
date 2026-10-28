const test = require('node:test');
const assert = require('node:assert/strict');
const Msg91Service = require('../services/msg91Service');
const SmsEmailService = require('../smsEmailService');
const db = require('../db');

test('1. International Phone Formatting & Normalization', () => {
  assert.equal(Msg91Service.formatInternationalPhone('+91', '9876543210'), '+919876543210');
  assert.equal(Msg91Service.formatInternationalPhone('91', '9876543210'), '+919876543210');
  assert.equal(Msg91Service.formatInternationalPhone('+91', '+919876543210'), '+919876543210');
  assert.equal(Msg91Service.formatInternationalPhone('+1', '5551234567'), '+15551234567');
  
  assert.equal(Msg91Service.formatMsg91Mobile('+919876543210'), '919876543210');
  assert.equal(Msg91Service.formatMsg91Mobile('+15551234567'), '15551234567');
});

test('2. Cryptographically Secure OTP Generation', () => {
  for (let i = 0; i < 50; i++) {
    const otp = Msg91Service.generateSecureOtp();
    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);
  }
});

test('3. OTP_DEV_MODE Behavior vs Production Credentials Check', async () => {
  process.env.OTP_DEV_MODE = 'true';
  const devRes = await Msg91Service.sendOTP('9876543210', '123456', { countryCode: '+91' });
  assert.equal(devRes.success, true);
  assert.equal(devRes.mode, 'dev');

  // Test Production mode throws clean error if credentials missing
  process.env.OTP_DEV_MODE = 'false';
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.MSG91_TEMPLATE_ID;

  await assert.rejects(
    async () => {
      await Msg91Service.sendOTP('9876543210', '123456', { countryCode: '+91' });
    },
    { message: 'SMS service is currently unconfigured on backend.' }
  );

  // Restore DEV_MODE for remaining tests
  process.env.OTP_DEV_MODE = 'true';
});

test('4. Database OTP Creation, Verification, and Consumption', async () => {
  const target = '+919876543210';
  const otp = '654321';
  const purpose = 'unit_test_verification';

  await db.createOtp({ target, target_type: 'phone', otp, purpose });

  // Verification with wrong OTP should fail
  const wrongRes = await db.verifyOtp({ target, otp: '000000', purpose });
  assert.equal(wrongRes.valid, false);
  assert.match(wrongRes.reason, /Incorrect verification code/);

  // Verification with correct OTP should succeed
  const validRes = await db.verifyOtp({ target, otp, purpose });
  assert.equal(validRes.valid, true);

  // Re-verifying consumed OTP should fail as expired/not found
  const reuseRes = await db.verifyOtp({ target, otp, purpose });
  assert.equal(reuseRes.valid, false);
  assert.match(reuseRes.reason, /has expired|expired or not found/);
});

test('5. Max Verification Attempts Limits & Session Invalidation (5 Attempts)', async () => {
  const target = '+919876543211';
  const otp = '777888';
  const purpose = 'max_attempts_test';

  await db.createOtp({ target, target_type: 'phone', otp, purpose });

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await db.verifyOtp({ target, otp: '111111', purpose });
    assert.equal(res.valid, false);
  }

  // 5th failed attempt invalidates session
  const fifthRes = await db.verifyOtp({ target, otp: '111111', purpose });
  assert.equal(fifthRes.valid, false);
  assert.match(fifthRes.reason, /invalidated/);

  // Submitting correct OTP now fails because session was deleted on 5th attempt
  const correctAfterMax = await db.verifyOtp({ target, otp, purpose });
  assert.equal(correctAfterMax.valid, false);
});

test('6. Resend Rate Limiting / Cooldown Check (45 Seconds)', async () => {
  const target = '+919876543212';
  const purpose = 'cooldown_test';
  const otp = '999000';

  await db.createOtp({ target, target_type: 'phone', otp, purpose });

  const cooldownCheck = await db.checkOtpCooldown({ target, purpose, cooldownSeconds: 45 });
  assert.equal(cooldownCheck.onCooldown, true);
  assert.ok(cooldownCheck.retryAfterSeconds > 0 && cooldownCheck.retryAfterSeconds <= 45);
});

test('7. Multiple Accounts Can Share Phone Number', async () => {
  const sharedPhone = '9999988888';
  const countryCode = '+91';

  const user1 = await db.createUser({
    username: 'user_phone_share_1_' + Date.now(),
    display_name: 'User One',
    country_code: countryCode,
    phone_number: sharedPhone,
    password: 'password123',
    public_identity_key: 'pub_key_1',
  });

  const user2 = await db.createUser({
    username: 'user_phone_share_2_' + Date.now(),
    display_name: 'User Two',
    country_code: countryCode,
    phone_number: sharedPhone,
    password: 'password123',
    public_identity_key: 'pub_key_2',
  });

  assert.ok(user1.id);
  assert.ok(user2.id);
  assert.equal(user1.phone_number, user2.phone_number);
});
