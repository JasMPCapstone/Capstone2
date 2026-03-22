/**
 * Ensures file_type column is large enough for Office MIME types.
 * Word .docx uses application/vnd.openxmlformats-officedocument.wordprocessingml.document (62 chars).
 * VARCHAR(50) in schema is too short; expand to VARCHAR(255).
 */
const { pool } = require('../config/database');

async function ensureFileTypeColumnSize() {
  try {
    const [rows] = await pool.query(
      "SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'file_type'"
    );
    const maxLen = rows[0] && Number(rows[0].CHARACTER_MAXIMUM_LENGTH);
    if (maxLen && maxLen >= 255) return;
    await pool.query('ALTER TABLE documents MODIFY COLUMN file_type VARCHAR(255) NOT NULL COMMENT \'e.g. application/pdf\'');
    console.log('Migration: expanded file_type column to VARCHAR(255).');
  } catch (err) {
    console.warn('Migration file_type:', err.message);
  }
}

module.exports = { ensureFileTypeColumnSize };
