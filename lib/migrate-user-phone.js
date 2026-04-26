/**
 * Ensures phone column exists on users (personal contact number).
 */
const { pool } = require('../config/database');

async function ensureUserPhoneColumn() {
  try {
    await pool.query('SELECT phone FROM users LIMIT 1');
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL');
    console.log('Migration: added phone column to users table.');
  } catch (alterErr) {
    console.warn('Migration user phone:', alterErr.message);
  }
}

module.exports = { ensureUserPhoneColumn };
