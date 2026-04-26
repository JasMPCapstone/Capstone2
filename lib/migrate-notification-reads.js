/**
 * Persist notification read state (bell): users.notifications_last_read_at + per-document reads.
 */
const { pool } = require('../config/database');

async function ensureNotificationReads() {
  try {
    await pool.query('SELECT notifications_last_read_at FROM users LIMIT 1');
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    try {
      await pool.query(
        'ALTER TABLE users ADD COLUMN notifications_last_read_at DATETIME NULL DEFAULT NULL'
      );
      console.log('Migration: added users.notifications_last_read_at');
    } catch (alterErr) {
      console.warn('Migration notification_reads (users column):', alterErr.message);
    }
  }

  try {
    await pool.query('SELECT 1 FROM notification_document_reads LIMIT 1');
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    try {
      await pool.query(`
        CREATE TABLE notification_document_reads (
          user_id INT UNSIGNED NOT NULL,
          document_id INT UNSIGNED NOT NULL,
          read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, document_id),
          KEY ndr_user (user_id),
          KEY ndr_document (document_id),
          CONSTRAINT ndr_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT ndr_doc_fk FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Migration: created notification_document_reads');
    } catch (createErr) {
      console.warn('Migration notification_document_reads:', createErr.message);
    }
  }
}

module.exports = { ensureNotificationReads };
