/**
 * Ensures documents.approval_status exists (PENDING | APPROVED | REJECTED).
 * Existing rows are marked APPROVED so only new uploads surface as pending for admins.
 */
const { pool } = require('../config/database');

const VALID = ['PENDING', 'APPROVED', 'REJECTED'];

async function ensureDocumentApprovalColumn() {
  try {
    await pool.query('SELECT approval_status FROM documents LIMIT 1');
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query(
      `ALTER TABLE documents ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'System admin review'`
    );
    await pool.query(
      `UPDATE documents SET approval_status = 'APPROVED' WHERE deleted_at IS NULL`
    );
    console.log('Migration: added approval_status to documents; existing files marked APPROVED.');
  } catch (alterErr) {
    console.warn('Migration approval_status:', alterErr.message);
  }
}

function normalizeApprovalStatus(value) {
  const v = (value || '').toString().trim().toUpperCase();
  return VALID.includes(v) ? v : 'PENDING';
}

module.exports = { ensureDocumentApprovalColumn, normalizeApprovalStatus, APPROVAL_STATUSES: VALID };
