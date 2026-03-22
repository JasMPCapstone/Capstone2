const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');

const router = express.Router();

const RESET_TOKEN_EXPIRY_HOURS = 1;

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(req.session.role === 'ADMIN' ? '/admin' : '/dashboard');
  }
  const message = req.query.message || '';
  res.render('login', { message });
});

router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  const message = req.query.message || '';
  res.render('register', { message });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const emailTrim = (email || '').toString().trim().toLowerCase();
  const pass = (password || '').toString();

  if (!emailTrim || !pass) {
    await log({ action: 'LOGIN_FAILURE', details: 'Missing email or password', req });
    return res.status(400).render('login', { message: 'Email and password are required.', alertType: 'error' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ? LIMIT 1',
      [emailTrim]
    );
    const user = rows[0];
    if (!user) {
      await log({ action: 'LOGIN_FAILURE', details: `Unknown email: ${emailTrim}`, req });
      return res.status(401).render('login', { message: 'Invalid email or password.', alertType: 'error' });
    }
    if (!user.is_active) {
      await log({ action: 'LOGIN_FAILURE', details: `Deactivated account: ${emailTrim}`, req });
      return res.status(403).render('login', { message: 'Account is deactivated.', alertType: 'error' });
    }
    const match = await bcrypt.compare(pass, user.password_hash);
    if (!match) {
      await log({ action: 'LOGIN_FAILURE', details: `Wrong password: ${emailTrim}`, req });
      return res.status(401).render('login', { message: 'Invalid email or password.', alertType: 'error' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.fullName = user.full_name;
    req.session.role = user.role;
    req.session.userActive = !!user.is_active;

    await log({ userId: user.id, action: 'LOGIN_SUCCESS', details: user.email, req });
    res.redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');
  } catch (err) {
    console.error(err);
    await log({ action: 'LOGIN_FAILURE', details: err.message, req });
    res.status(500).render('login', { message: 'Server error. Please try again.', alertType: 'error' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body || {};
  const emailTrim = (email || '').toString().trim().toLowerCase();
  const pass = (password || '').toString();
  const name = (fullName || '').toString().trim();

  if (!emailTrim || !pass || !name) {
    return res.status(400).render('register', { message: 'Email, password, and full name are required.', alertType: 'error' });
  }
  if (pass.length < 6) {
    return res.status(400).render('register', { message: 'Password must be at least 6 characters.', alertType: 'error' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrim)) {
    return res.status(400).render('register', { message: 'Please enter a valid email address.', alertType: 'error' });
  }

  try {
    const hash = await bcrypt.hash(pass, 10);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [emailTrim, hash, name || emailTrim, 'CLIENT']
    );
    await log({ action: 'REGISTER', details: emailTrim, req });
    res.redirect('/login?message=Registration successful. Please log in.');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).render('register', { message: 'An account with this email already exists.', alertType: 'error' });
    }
    console.error(err);
    res.status(500).render('register', { message: 'Registration failed. Please try again.', alertType: 'error' });
  }
});

router.get('/forgot-password', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.render('forgot-password', { message: req.query.message || '' });
});

router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').toString().trim().toLowerCase();
  if (!email) {
    return res.status(400).render('forgot-password', { message: 'Please enter your email.', alertType: 'error' });
  }
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? AND is_active = 1', [email]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await pool.query(
      'CREATE TABLE IF NOT EXISTS password_reset_tokens (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, token VARCHAR(64) NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY token (token), KEY email (email))'
    );
    await pool.query('DELETE FROM password_reset_tokens WHERE email = ?', [email]);
    if (rows.length > 0) {
      await pool.query('INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)', [email, token, expiresAt]);
    }
    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    res.render('forgot-password-done', { resetLink, hasUser: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).render('forgot-password', { message: 'Something went wrong. Please try again.', alertType: 'error' });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  const token = (req.params.token || '').trim();
  if (!token) return res.redirect('/forgot-password');
  try {
    const [rows] = await pool.query('SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()', [token]);
    if (rows.length === 0) {
      return res.redirect('/forgot-password?message=This reset link has expired or is invalid.');
    }
    res.render('reset-password', { token });
  } catch (err) {
    console.error(err);
    res.redirect('/forgot-password');
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const token = (req.params.token || '').trim();
  const password = (req.body.password || '').toString();
  if (!token) return res.redirect('/forgot-password');
  if (!password || password.length < 6) {
    return res.status(400).render('reset-password', { token, message: 'Password must be at least 6 characters.', alertType: 'error' });
  }
  try {
    const [rows] = await pool.query('SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()', [token]);
    if (rows.length === 0) {
      return res.redirect('/forgot-password?message=This reset link has expired or is invalid.');
    }
    const email = rows[0].email;
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
    await log({ action: 'PASSWORD_RESET', details: email, req });
    res.redirect('/login?message=Password reset successfully. Please sign in.');
  } catch (err) {
    console.error(err);
    res.status(500).render('reset-password', { token, message: 'Failed to reset password.', alertType: 'error' });
  }
});

router.post('/logout', async (req, res) => {
  const userId = req.session && req.session.userId;
  if (userId) {
    await log({ userId, action: 'LOGOUT', req });
  }
  req.session.destroy(() => {});
  res.redirect('/login');
});

module.exports = router;
