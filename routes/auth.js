const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const {
  create: createPendingLogin,
  get: getPendingLogin,
  consume: consumePendingLogin,
} = require('../lib/pending-login');
const { verifyToken } = require('../lib/twofactor');
const { isSystemAdmin } = require('../lib/roles');
const { applyUserToSession } = require('../lib/session-user');
const { requireAuth } = require('../middleware/auth');
const { authLogin: loginLimiter, authForgot: forgotLimiter } = require('../middleware/rateLimit');
const { safeParseLogin, safeParseLogin2fa, safeParseChangePassword } = require('../lib/validation/schemas');

function postLoginRedirect(role) {
  return isSystemAdmin(role) ? '/admin' : '/dashboard';
}

const router = express.Router();

const RESET_TOKEN_EXPIRY_HOURS = 1;

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect(req.session.role));
  }
  const message = req.query.message || '';
  res.render('login', { message });
});

router.get('/login/2fa', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect(req.session.role));
  }
  const token = (req.query.token || '').trim();
  if (!token) {
    return res.redirect('/login?message=Please sign in first.');
  }
  res.render('login-2fa', { token, message: req.query.message || '' });
});

router.post('/login/2fa', loginLimiter, async (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect(req.session.role));
  }
  const merged = {
    ...(req.body || {}),
    token: ((req.body && req.body.token) || (req.query && req.query.token) || '').trim(),
  };
  const parsed2fa = safeParseLogin2fa(merged);
  if (!parsed2fa.ok) {
    return res.status(400).render('login-2fa', {
      token: merged.token || '',
      message: parsed2fa.error,
      alertType: 'error',
    });
  }
  const token = parsed2fa.data.token;
  const code = parsed2fa.data.code;
  const pending = getPendingLogin(token);
  if (!pending) {
    await log({ action: 'LOGIN_FAILURE', details: '2FA token expired or invalid', req });
    return res.redirect('/login?message=Verification session expired. Please sign in again.');
  }
  try {
    const [rows] = await pool.query(
      'SELECT two_factor_secret FROM users WHERE id = ? AND two_factor_enabled = 1',
      [pending.userId]
    );
    const user = rows[0];
    if (!user || !user.two_factor_secret) {
      await log({ action: 'LOGIN_FAILURE', details: '2FA not configured', req });
      return res.redirect('/login?message=Two-factor authentication is not set up for this account.');
    }
    const valid = verifyToken(user.two_factor_secret, code);
    if (!valid) {
      await log({ action: 'LOGIN_FAILURE', details: `Invalid 2FA code for user ${pending.userId}`, req });
      return res.status(400).render('login-2fa', {
        token,
        message: 'Invalid verification code. Please try again.',
        alertType: 'error',
      });
    }
    consumePendingLogin(token);
    req.session.userId = pending.userId;
    req.session.email = pending.email;
    req.session.fullName = pending.fullName;
    req.session.role = pending.role;
    req.session.userActive = pending.userActive;
    req.session.passwordMustChange = pending.passwordMustChange;
    req.session.profileCompleted = pending.profileCompleted;
    req.session.twoFactorEnabled = true;
    req.session.companyId = pending.companyId;
    await log({ userId: pending.userId, action: 'LOGIN_SUCCESS', details: `${pending.email} (2FA)`, req });
    res.redirect(postLoginRedirect(pending.role));
  } catch (err) {
    console.error(err);
    await log({ action: 'LOGIN_FAILURE', details: err.message, req });
    res.status(500).render('login-2fa', {
      token,
      message: 'Verification failed. Please try again.',
      alertType: 'error',
    });
  }
});

router.get('/register', (req, res) => {
  res.redirect('/login?message=' + encodeURIComponent('Registration is not available. Your administrator will create your account.'));
});

router.get('/account/change-password', requireAuth, (req, res) => {
  res.render('account/change-password', {
    message: '',
    navActive: null,
    user: { passwordMustChange: !!req.session.passwordMustChange },
  });
});

router.post('/account/change-password', requireAuth, async (req, res) => {
  const pwUser = { passwordMustChange: !!req.session.passwordMustChange };
  const parsed = safeParseChangePassword(req.body);
  if (!parsed.ok) {
    return res.status(400).render('account/change-password', {
      message: parsed.error,
      alertType: 'error',
      navActive: null,
      user: pwUser,
    });
  }
  const current = (req.body.currentPassword || '').toString();
  const nextPass = parsed.data.newPassword;
  try {
    const [rows] = await pool.query(
      'SELECT password_hash, password_must_change FROM users WHERE id = ?',
      [req.session.userId]
    );
    const u = rows[0];
    if (!u) return res.redirect('/login');
    const needCurrent = !u.password_must_change;
    if (needCurrent) {
      if (!current || !(await bcrypt.compare(current, u.password_hash))) {
        return res.status(400).render('account/change-password', {
          message: 'Current password is incorrect.',
          alertType: 'error',
          navActive: null,
          user: pwUser,
        });
      }
    } else {
      if (!current || !(await bcrypt.compare(current, u.password_hash))) {
        return res.status(400).render('account/change-password', {
          message: 'Temporary password is incorrect.',
          alertType: 'error',
          navActive: null,
          user: pwUser,
        });
      }
    }
    const hash = await bcrypt.hash(nextPass, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, password_must_change = 0 WHERE id = ?',
      [hash, req.session.userId]
    );
    req.session.passwordMustChange = false;
    await log({ userId: req.session.userId, action: 'PASSWORD_CHANGED', details: 'User set new password', req });
    res.redirect('/dashboard?onboarding=profile');
  } catch (err) {
    console.error(err);
    res.status(500).render('account/change-password', {
      message: 'Could not update password.',
      alertType: 'error',
      navActive: null,
      user: pwUser,
    });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = safeParseLogin(req.body);
  if (!parsed.ok) {
    await log({ action: 'LOGIN_FAILURE', details: parsed.error, req });
    return res.status(400).render('login', { message: parsed.error, alertType: 'error' });
  }
  const emailTrim = parsed.data.email;
  const pass = parsed.data.password;

  try {
    const [rows] = await pool.query(
      `SELECT id, email, password_hash, full_name, role, is_active, two_factor_enabled,
              COALESCE(password_must_change, 0) AS password_must_change,
              COALESCE(profile_completed, 1) AS profile_completed,
              company_id
       FROM users WHERE email = ? LIMIT 1`,
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

    if (user.two_factor_enabled) {
      const token = createPendingLogin(user.id, user.email, user.full_name, user.role, !!user.is_active, {
        passwordMustChange: !!user.password_must_change,
        profileCompleted: !!user.profile_completed,
        twoFactorEnabled: true,
        companyId: user.company_id,
      });
      return res.redirect('/login/2fa?token=' + encodeURIComponent(token));
    }

    applyUserToSession(req, user);

    await log({ userId: user.id, action: 'LOGIN_SUCCESS', details: user.email, req });
    res.redirect(postLoginRedirect(user.role));
  } catch (err) {
    console.error(err);
    await log({ action: 'LOGIN_FAILURE', details: err.message, req });
    res.status(500).render('login', { message: 'Server error. Please try again.', alertType: 'error' });
  }
});

router.post('/register', (req, res) => {
  res.redirect('/login?message=' + encodeURIComponent('Registration is not available. Your administrator will create your account.'));
});

router.get('/forgot-password', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.render('forgot-password', { message: req.query.message || '' });
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
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
    await pool.query(
      'UPDATE users SET password_hash = ?, password_must_change = 0 WHERE email = ?',
      [hash, email]
    );
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
