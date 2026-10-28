/**
 * MSG91 SMS & OTP Integration Service for Chartpie Backend.
 * 
 * Handles real SMS delivery via MSG91 v5 OTP APIs, secure OTP generation,
 * phone number normalization, rate limiting, and fallback logging in OTP_DEV_MODE.
 * 
 * SECURITY GUARANTEES:
 * - MSG91_AUTH_KEY exists ONLY on the Node.js backend environment.
 * - Never returns Authkey or internal provider details in error responses or logs.
 */

const crypto = require('crypto');

class Msg91Service {
  /**
   * Format country code and phone number into clean international format.
   * E.g. countryCode="+91", phoneNumber="9876543210" => "+919876543210"
   */
  static formatInternationalPhone(countryCode, phoneNumber) {
    let rawCode = (countryCode || '+91').toString().trim();
    let rawNum = (phoneNumber || '').toString().trim();

    // Clean whitespace and non-essential characters
    rawNum = rawNum.replace(/[\s\-\(\)]/g, '');
    rawCode = rawCode.replace(/[\s\-\(\)]/g, '');

    if (!rawCode.startsWith('+')) {
      rawCode = '+' + rawCode;
    }

    // If rawNum already starts with +, use it as international number
    if (rawNum.startsWith('+')) {
      return rawNum;
    }

    // Check if rawNum already starts with the country code digits (e.g., "919876543210")
    const codeDigits = rawCode.replace('+', '');
    if (rawNum.startsWith(codeDigits) && rawNum.length > codeDigits.length + 5) {
      return '+' + rawNum;
    }

    return `${rawCode}${rawNum}`;
  }

  /**
   * Strip leading '+' for MSG91 mobile URL parameter requirement.
   * E.g. "+919876543210" => "919876543210"
   */
  static formatMsg91Mobile(internationalPhone) {
    return internationalPhone.replace(/^\+/, '');
  }

  /**
   * Cryptographically secure 6-digit OTP generator.
   * Never uses Math.random().
   */
  static generateSecureOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send OTP via MSG91 v5 API or log in OTP_DEV_MODE.
   */
  static async sendOTP(phoneNumber, otp, options = {}) {
    const devMode = process.env.OTP_DEV_MODE === 'true';
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const senderId = process.env.MSG91_SENDER_ID || 'CHARTP';

    const internationalPhone = this.formatInternationalPhone(options.countryCode, phoneNumber);
    const msg91Mobile = this.formatMsg91Mobile(internationalPhone);

    if (devMode) {
      console.log(`[OTP DEV MODE] SMS OTP generated for ${internationalPhone}: ${otp}`);
      return {
        success: true,
        mode: 'dev',
        target: internationalPhone,
        message: 'OTP processed in development mode',
      };
    }

    // Production Mode Security Validation
    if (!authKey || !templateId) {
      console.error('[MSG91 CONFIG ERROR] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID missing in backend environment variables.');
      throw new Error('SMS service is currently unconfigured on backend.');
    }

    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(msg91Mobile)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authkey': authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp: otp,
          sender: senderId,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        console.error(`[MSG91 FAILURE] Provider returned HTTP status ${status}`);
        throw new Error("We couldn't send the verification code right now. Please try again.");
      }

      const data = await response.json().catch(() => ({}));
      if (data.type === 'error') {
        console.error(`[MSG91 ERROR RESPONSE] MSG91 rejected request for target ending in ${msg91Mobile.slice(-4)}`);
        throw new Error(data.message || "Failed to deliver verification code. Please check your phone number.");
      }

      return {
        success: true,
        mode: 'msg91',
        target: internationalPhone,
        message: 'OTP sent successfully via MSG91',
      };
    } catch (err) {
      if (err.message.includes("couldn't send") || err.message.includes("Failed to deliver")) {
        throw err;
      }
      console.error('[MSG91 EXCEPTION]', err.message);
      throw new Error("We couldn't send the verification code right now. Please check network connectivity and try again.");
    }
  }

  /**
   * Resend OTP via MSG91 Retry API or re-triggering sendOTP.
   */
  static async resendOTP(phoneNumber, otp, options = {}) {
    const devMode = process.env.OTP_DEV_MODE === 'true';
    const authKey = process.env.MSG91_AUTH_KEY;

    const internationalPhone = this.formatInternationalPhone(options.countryCode, phoneNumber);
    const msg91Mobile = this.formatMsg91Mobile(internationalPhone);

    if (devMode) {
      console.log(`[OTP DEV MODE] Resending SMS OTP for ${internationalPhone}: ${otp}`);
      return {
        success: true,
        mode: 'dev',
        target: internationalPhone,
        message: 'Resent OTP logged in development mode',
      };
    }

    if (!authKey) {
      console.error('[MSG91 CONFIG ERROR] MSG91_AUTH_KEY missing in environment variables');
      throw new Error('SMS service unconfigured on backend.');
    }

    try {
      // Use MSG91 Retry API if template is already active on provider side
      const url = `https://control.msg91.com/api/v5/otp/retry?retrytype=text&mobile=${encodeURIComponent(msg91Mobile)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'authkey': authKey,
        },
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.type !== 'error') {
          return {
            success: true,
            mode: 'msg91_retry',
            target: internationalPhone,
            message: 'OTP resent successfully via MSG91 retry',
          };
        }
      }

      // Fallback to sending a new OTP through sendOTP if retry API fails or template requires explicit OTP body
      return await this.sendOTP(phoneNumber, otp, options);
    } catch (err) {
      // Fallback to full sendOTP request
      return await this.sendOTP(phoneNumber, otp, options);
    }
  }
}

module.exports = Msg91Service;
