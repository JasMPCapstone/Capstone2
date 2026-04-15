/**
 * Ensures documents.document_type exists (nullable label, e.g. compliance category).
 */
const { pool } = require('../config/database');

async function ensureDocumentTypeColumn() {
  try {
    await pool.query('SELECT document_type FROM documents LIMIT 1');
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query(
      `ALTER TABLE documents ADD COLUMN document_type VARCHAR(100) DEFAULT NULL COMMENT 'e.g. Facility Accreditation Certificate'`
    );
    console.log('Migration: added document_type to documents.');
  } catch (alterErr) {
    console.warn('Migration document_type:', alterErr.message);
  }
}

module.exports = { ensureDocumentTypeColumn };
