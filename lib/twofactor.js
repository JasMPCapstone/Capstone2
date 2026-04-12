/**
 * Two-Factor Authentication (TOTP) helpers.
 * Uses speakeasy for TOTP and qrcode for QR generation.
 * otpauth format: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const ISSUER = 'MedSupply';

/**
 * Generate a new TOTP secret for a user.
 * @param {string} email - User email (shown in authenticator app)
 * @returns {{ secret: string, otpauth: string }}
 */
function generateSecret(email) {
  const secret = speakeasy.generateSecret({ length: 32 });
  const account = (email || 'user').trim().toLowerCase();
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}`;
  const otpauth = `otpauth://totp/${label}?secret=${secret.base32}&issuer=${encodeURIComponent(ISSUER)}`;
  return {
    secret: secret.base32,
    otpauth,
  };
}

/**
 * Verify a TOTP token against a secret.
 * @param {string} secret - Base32 secret
 * @param {string} token - 6-digit code from authenticator app
 * @returns {boolean}
 */
function verifyToken(secret, token) {
  if (!secret || !token || token.length !== 6) return false;
  const trimmed = (token || '').toString().trim().replace(/\s/g, '');
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: trimmed,
    window: 1, // Allow 1 step tolerance (30 sec before/after)
  });
}

/**
 * Generate QR code as data URL for scanning in authenticator app.
 * @param {string} otpauthUrl - otpauth:// URL from generateSecret
 * @returns {Promise<string>} Data URL (e.g. data:image/png;base64,...)
 */
function getQRDataURL(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, {
    width: 280,
    margin: 3,
    errorCorrectionLevel: 'M',
  });
}

module.exports = { generateSecret, verifyToken, getQRDataURL };
