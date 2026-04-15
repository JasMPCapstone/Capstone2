const { pool } = require('../config/database');

function clientIp(req) {
  if (!req) return null;
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (xff) {
    const raw = typeof xff === 'string' ? xff : xff[0];
    const first = raw.split(',')[0].trim();
    if (first) return first.slice(0, 45);
  }
  if (req.ip) return String(req.ip).slice(0, 45);
  if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress).slice(0, 45);
  return null;
}

/**
 * Append a row to audit_logs. Never throws (logs errors to console).
 * @param {{ userId?: number|null, action: string, details?: string|null, req?: import('express').Request }} opts
 */
async function log(opts) {
  const { userId, action, details, req } = opts || {};
  try {
    const actionStr = (action != null ? String(action) : 'UNKNOWN').slice(0, 100);
    let uid = userId != null && userId !== '' ? Number(userId) : null;
    if (uid != null && Number.isNaN(uid)) uid = null;

    let detailsStr = details;
    if (detailsStr != null && typeof detailsStr !== 'string') {
      detailsStr = JSON.stringify(detailsStr);
    }
    if (detailsStr != null) detailsStr = String(detailsStr).slice(0, 65535);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [uid, actionStr, detailsStr || null, clientIp(req)]
    );
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { log };
