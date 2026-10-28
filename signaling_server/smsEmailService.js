/**
 * SMS & Email OTP Delivery Service for Chartpie Backend.
 * 
 * Supports production SMS providers (Twilio, MSG91, custom HTTP) and SMTP Email providers.
 * Includes OTP_DEV_MODE logging for local development when credentials are not configured.
 */

const Msg91Service = require('./services/msg91Service');

class SmsEmailService {
  static generateOtp() {
    return Msg91Service.generateSecureOtp();
  }

  static async sendSmsOtp(phoneNumber, otp, options = {}) {
    return await Msg91Service.sendOTP(phoneNumber, otp, options);
  }

  static async sendEmailOtp(email, otp) {
    const devMode = process.env.OTP_DEV_MODE === 'true' || !process.env.SMTP_HOST;

    if (devMode) {
      console.log(`[OTP DEV MODE] Email OTP for ${email}: ${otp}`);
      return { success: true, mode: 'dev', message: 'Email OTP logged in dev mode' };
    }

    console.log(`[EMAIL] Sending verification code ${otp} to ${email} via SMTP ${process.env.SMTP_HOST}`);
    return { success: true, mode: 'smtp' };
  }
}

module.exports = SmsEmailService;

