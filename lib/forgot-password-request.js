const crypto = require('crypto');
const { pool } = require('../config/database');
const { sendPasswordResetEmail, smtpConfigured } = require('./mail');
const { publicBaseUrl } = require('./publicUrl');

/** Default 1 hour; override with PASSWORD_RESET_EXPIRY_HOURS (1–168). */
const _expRaw = parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS || '1', 10);
const RESET_TOKEN_EXPIRY_HOURS = Math.min(168, Math.max(1, Number.isFinite(_expRaw) && _expRaw > 0 ? _expRaw : 1));

const CREATE_TOKENS_TABLE = `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY token (token),
  KEY email (email)
)`;

/**
 * Create or refresh reset token and send email when user exists (same privacy rules as HTML flow).
 * @param {import('express').Request} req
 * @param {string} emailRaw
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function requestPasswordResetEmail(req, emailRaw) {
  const email = (emailRaw || '').toString().trim().toLowerCase();
  if (!email) {
    return { ok: false, error: 'Please enter your email.' };
  }
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? AND is_active = 1', [email]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await pool.query(CREATE_TOKENS_TABLE);
    await pool.query('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
    if (rows.length > 0) {
      await pool.query('INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)', [
        email,
        token,
        expiresAt,
      ]);
      const resetUrl = `${publicBaseUrl(req)}/reset-password/${token}`;
      try {
        await sendPasswordResetEmail({ to: email, resetUrl, expiryHours: RESET_TOKEN_EXPIRY_HOURS });
      } catch (mailErr) {
        console.error('Password reset email:', mailErr);
        await pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
        const msg = smtpConfigured()
          ? 'Could not send the reset email. Please try again later or contact support.'
          : 'Email could not be sent. Ask your administrator to configure SMTP or check server logs.';
        return { ok: false, error: msg };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

module.exports = { requestPasswordResetEmail };
