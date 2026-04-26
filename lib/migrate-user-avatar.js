/**
 * Optional profile photo stored on disk; filename in users.avatar_filename.
 */
const { pool } = require('../config/database');

async function ensureUserAvatarColumn() {
  try {
    await pool.query('SELECT avatar_filename FROM users LIMIT 1');
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    try {
      await pool.query('ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(255) DEFAULT NULL');
      console.log('Migration: added users.avatar_filename');
    } catch (alterErr) {
      console.warn('Migration avatar_filename:', alterErr.message);
    }
  }
}

module.exports = { ensureUserAvatarColumn };
