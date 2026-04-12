/**
 * Ensures two_factor columns exist in users table for 2FA.
 */
const { pool } = require('../config/database');

async function ensureTwoFactorColumns() {
  try {
    await pool.query('SELECT two_factor_enabled FROM users LIMIT 1');
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query(
      'ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) DEFAULT NULL, ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0'
    );
    console.log('Migration: added two_factor columns to users table.');
  } catch (alterErr) {
    console.warn('Migration two_factor:', alterErr.message);
  }
}

module.exports = { ensureTwoFactorColumns };
