const { pool } = require('../config/database');

/**
 * Log an action to audit_logs.
 * @param {Object} options - { userId?, action, details?, req? (for ip) }
 */
async function log(options) {
  const { userId = null, action, details = null, req } = options;
  const ip = req && req.ip ? req.ip : (req && req.connection && req.connection.remoteAddress) || null;
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [userId, action, details ? String(details).substring(0, 2000) : null, ip]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { log };
