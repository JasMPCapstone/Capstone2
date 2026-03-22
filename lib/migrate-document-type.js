/**
 * Ensures document_type column exists in documents table.
 * Run on app startup so filtering works for older databases.
 */
const { pool } = require('../config/database');

async function ensureDocumentTypeColumn() {
  try {
    await pool.query('SELECT document_type FROM documents LIMIT 1');
    return; // Column exists
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  try {
    await pool.query(
      'ALTER TABLE documents ADD COLUMN document_type VARCHAR(100) DEFAULT NULL COMMENT \'e.g. Facility Accreditation Certificate\''
    );
    console.log('Migration: added document_type column to documents table.');
  } catch (alterErr) {
    console.warn('Migration document_type:', alterErr.message);
  }
}

module.exports = { ensureDocumentTypeColumn };
