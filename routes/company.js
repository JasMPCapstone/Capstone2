const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const { requireAuth, requireClientAdmin } = require('../middleware/auth');
const { enforceOnboarding } = require('../middleware/onboarding');

const router = express.Router();
router.use(requireAuth);
router.use(enforceOnboarding);
router.use(requireClientAdmin);

router.get('/team', async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) {
      return res.status(400).render('error', { message: 'Your account is not linked to an organization.' });
    }
    const [companyRows] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
    const companyName = companyRows[0] ? companyRows[0].name : '';
    const [members] = await pool.query(
      `SELECT id, email, full_name, role, is_active, password_must_change, profile_completed, created_at
       FROM users WHERE company_id = ? ORDER BY role DESC, full_name ASC`,
      [companyId]
    );
    const message = req.query.message || '';
    res.render('company/team', {
      companyName,
      members,
      message,
      navActive: 'team',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load team.' });
  }
});

router.post('/team', async (req, res) => {
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();
  const companyId = req.session.companyId;

  if (!companyId) return res.redirect('/company/team?message=Invalid organization');
  if (!emailTrim || !fullName || !tempPassword) {
    return res.redirect('/company/team?message=Email, full name, and temporary password are required');
  }
  if (tempPassword.length < 6) {
    return res.redirect('/company/team?message=Temporary password must be at least 6 characters');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrim)) {
    return res.redirect('/company/team?message=Invalid email address');
  }

  try {
    const [[org]] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
    const orgName = org ? org.name : null;
    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT', ?, 1, 0, ?)`,
      [emailTrim, hash, fullName, companyId, orgName]
    );
    await log({
      userId: req.session.userId,
      action: 'CLIENT_ADMIN_CREATE_USER',
      details: `email=${emailTrim} company_id=${companyId}`,
      req,
    });
    res.redirect('/company/team?message=User created. They must sign in with the temporary password.');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect('/company/team?message=An account with this email already exists');
    }
    console.error(err);
    res.redirect('/company/team?message=Could not create user');
  }
});

router.post('/team/:id/deactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  if (!id || !companyId) return res.redirect('/company/team');
  if (id === req.session.userId) return res.redirect('/company/team?message=You cannot deactivate yourself');
  try {
    const [rows] = await pool.query(
      'SELECT id, email, role FROM users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    const u = rows[0];
    if (!u || u.role !== 'CLIENT') {
      return res.redirect('/company/team?message=Only team members with the staff role can be deactivated here');
    }
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'CLIENT_ADMIN_DEACTIVATE',
      details: `user_id=${id} email=${u.email}`,
      req,
    });
    res.redirect('/company/team?message=User deactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/company/team?message=Action failed');
  }
});

router.post('/team/:id/reactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  if (!id || !companyId) return res.redirect('/company/team');
  try {
    const [rows] = await pool.query(
      'SELECT id, email, role FROM users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    const u = rows[0];
    if (!u || u.role !== 'CLIENT') {
      return res.redirect('/company/team?message=Invalid user');
    }
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'CLIENT_ADMIN_REACTIVATE',
      details: `user_id=${id}`,
      req,
    });
    res.redirect('/company/team?message=User reactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/company/team?message=Action failed');
  }
});

router.get('/team/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  if (!id || !companyId) return res.redirect('/company/team');
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    const targetUser = rows[0];
    if (!targetUser || targetUser.role !== 'CLIENT') {
      return res.status(403).render('error', { message: 'You can only reset passwords for staff on your team.' });
    }
    res.render('company/reset-password', { targetUser, message: req.query.message || '', navActive: 'team' });
  } catch (err) {
    console.error(err);
    res.redirect('/company/team');
  }
});

router.post('/team/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  const newPassword = (req.body.newPassword || '').toString();
  if (!id || !companyId) return res.redirect('/company/team');
  if (newPassword.length < 6) {
    return res.redirect(`/company/team/${id}/reset-password?message=Password must be at least 6 characters`);
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, email, role FROM users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    const targetUser = rows[0];
    if (!targetUser || targetUser.role !== 'CLIENT') {
      return res.redirect('/company/team?message=Invalid user');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, password_must_change = 1, profile_completed = 0, two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?',
      [hash, id]
    );
    await log({
      userId: req.session.userId,
      action: 'CLIENT_ADMIN_PASSWORD_RESET',
      details: `user_id=${id} email=${targetUser.email}`,
      req,
    });
    res.redirect('/company/team?message=Temporary password set. The user must sign in and complete setup again.');
  } catch (err) {
    console.error(err);
    res.redirect('/company/team?message=Reset failed');
  }
});

module.exports = router;
