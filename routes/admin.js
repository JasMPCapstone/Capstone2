const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [docCount] = await pool.query('SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL');
    const [logCount] = await pool.query('SELECT COUNT(*) AS c FROM audit_logs');
    res.render('admin/dashboard', {
      userCount: userCount[0].c,
      docCount: docCount[0].c,
      logCount: logCount[0].c,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load dashboard.' });
  }
});

// List users
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.render('admin/users', { users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load users.' });
  }
});

// Deactivate user
router.post('/users/:id/deactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  if (id === req.session.userId) {
    return res.redirect('/admin/users?message=Cannot deactivate yourself');
  }
  try {
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect('/admin/users');
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_DEACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect('/admin/users?message=User deactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Action failed');
  }
});

// Reactivate user
router.post('/users/:id/reactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  try {
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect('/admin/users');
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_REACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect('/admin/users?message=User reactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Action failed');
  }
});

// Reset password form
router.get('/users/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  try {
    const [rows] = await pool.query('SELECT id, email, full_name FROM users WHERE id = ?', [id]);
    const targetUser = rows[0];
    if (!targetUser) return res.status(404).render('error', { message: 'User not found.' });
    const message = req.query.message || '';
    res.render('admin/reset-password', { targetUser, message });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

// Reset password submit
router.post('/users/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const newPassword = (req.body.newPassword || '').toString();
  if (!id) return res.redirect('/admin/users');
  if (newPassword.length < 6) {
    return res.redirect(`/admin/users/${id}/reset-password?message=Password must be at least 6 characters`);
  }
  try {
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    const targetUser = rows[0];
    if (!targetUser) return res.redirect('/admin/users');
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_PASSWORD_RESET',
      details: `user_id=${id} email=${targetUser.email}`,
      req,
    });
    res.redirect('/admin/users?message=Password reset successfully');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Reset failed');
  }
});

// Audit logs with filters
router.get('/audit', async (req, res) => {
  try {
    const action = (req.query.action || '').trim();
    const userId = (req.query.userId || '').trim();
    const dateFrom = (req.query.dateFrom || '').trim();
    const dateTo = (req.query.dateTo || '').trim();

    let sql = `
      SELECT a.id, a.user_id, a.action, a.details, a.ip_address, a.created_at, u.email, u.full_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }
    if (userId) {
      sql += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (dateFrom) {
      sql += ' AND a.created_at >= ?';
      params.push(dateFrom + ' 00:00:00');
    }
    if (dateTo) {
      sql += ' AND a.created_at <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.render('admin/audit', {
      logs: rows,
      query: req.query,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load audit logs.' });
  }
});

module.exports = router;
