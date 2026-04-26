/**
 * Stores system-admin rejection reason on documents (shown to client admins).
 */
const { pool } = require('../config/database');

async function ensureDocumentRejectionReasonColumn() {
  try {
    await pool.query('SELECT approval_rejection_reason FROM documents LIMIT 1');
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query(
      "ALTER TABLE documents ADD COLUMN approval_rejection_reason TEXT DEFAULT NULL COMMENT 'System admin rejection note'"
    );
    console.log('Migration: added documents.approval_rejection_reason');
  } catch (alterErr) {
    console.warn('Migration approval_rejection_reason:', alterErr.message);
  }
}

module.exports = { ensureDocumentRejectionReasonColumn };
