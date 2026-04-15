/**
 * Ensures documents.file_type can store long MIME strings (e.g. vendor-specific types).
 */
const { pool } = require('../config/database');

async function ensureFileTypeColumnSize() {
  try {
    const [rows] = await pool.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'file_type'`
    );
    const len = rows[0] && rows[0].len != null ? Number(rows[0].len) : null;
    if (len != null && len >= 255) return;
  } catch (e) {
    // INFORMATION_SCHEMA may fail in some setups; fall through to ALTER attempt
  }
  try {
    await pool.query(
      `ALTER TABLE documents MODIFY COLUMN file_type VARCHAR(255) NOT NULL COMMENT 'e.g. application/pdf'`
    );
    console.log('Migration: widened documents.file_type to VARCHAR(255).');
  } catch (alterErr) {
    console.warn('Migration file_type:', alterErr.message);
  }
}

module.exports = { ensureFileTypeColumnSize };
