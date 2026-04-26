const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const {
  create: createPendingLogin,
  get: getPendingLogin,
  consume: consumePendingLogin,
} = require('../lib/pending-login');
const { verifyToken } = require('../lib/twofactor');
const { applyUserToSession } = require('../lib/session-user');
const { requireAuth } = require('../middleware/auth');
const { authLogin: loginLimiter, authForgot: forgotLimiter } = require('../middleware/rateLimit');
const { safeParseLogin, safeParseLogin2fa, safeParseChangePassword } = require('../lib/validation/schemas');
const { sendSpaOr503 } = require('../lib/spa');
const { requestPasswordResetEmail } = require('../lib/forgot-password-request');

function postLoginRedirect() {
  return '/';
}

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect());
  }
  return sendSpaOr503(res);
});

router.get('/login/2fa', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect());
  }
  const token = (req.query.token || '').trim();
  if (!token) {
    return res.redirect('/login?message=Please sign in first.');
  }
  return sendSpaOr503(res);
});

router.post('/login/2fa', loginLimiter, async (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(postLoginRedirect());
  }
  const merged = {
    ...(req.body || {}),
    token: ((req.body && req.body.token) || (req.query && req.query.token) || '').trim(),
  };
  const parsed2fa = safeParseLogin2fa(merged);
  if (!parsed2fa.ok) {
    const t = merged.token || '';
    return res.redirect(
      `/login/2fa?token=${encodeURIComponent(t)}&message=${encodeURIComponent(parsed2fa.error)}&error=1`
    );
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
      'SELECT two_factor_secret, preferred_name FROM users WHERE id = ? AND two_factor_enabled = 1',
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
      return res.redirect(
        `/login/2fa?token=${encodeURIComponent(token)}&message=${encodeURIComponent('Invalid verification code. Please try again.')}&error=1`
      );
    }
    consumePendingLogin(token);
    req.session.userId = pending.userId;
    req.session.email = pending.email;
    req.session.fullName = pending.fullName;
    req.session.preferredName =
      user.preferred_name != null && String(user.preferred_name).trim()
        ? String(user.preferred_name).trim()
        : null;
    req.session.role = pending.role;
    req.session.userActive = pending.userActive;
    req.session.passwordMustChange = pending.passwordMustChange;
    req.session.profileCompleted = pending.profileCompleted;
    req.session.twoFactorEnabled = true;
    req.session.companyId = pending.companyId;
    await log({ userId: pending.userId, action: 'LOGIN_SUCCESS', details: `${pending.email} (2FA)`, req });
    res.redirect(postLoginRedirect());
  } catch (err) {
    console.error(err);
    await log({ action: 'LOGIN_FAILURE', details: err.message, req });
    return res.redirect(
      `/login/2fa?token=${encodeURIComponent(token)}&message=${encodeURIComponent('Verification failed. Please try again.')}&error=1`
    );
  }
});

router.get('/register', (req, res) => {
  res.redirect('/login?message=' + encodeURIComponent('Registration is not available. Your administrator will create your account.'));
});

router.get('/account/change-password', requireAuth, (req, res) => sendSpaOr503(res));

router.post('/account/change-password', requireAuth, async (req, res) => {
  const parsed = safeParseChangePassword(req.body);
  if (!parsed.ok) {
    return res.redirect(`/account/change-password?message=${encodeURIComponent(parsed.error)}&error=1`);
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
        return res.redirect('/account/change-password?message=' + encodeURIComponent('Current password is incorrect.') + '&error=1');
      }
    } else {
      if (!current || !(await bcrypt.compare(current, u.password_hash))) {
        return res.redirect('/account/change-password?message=' + encodeURIComponent('Temporary password is incorrect.') + '&error=1');
      }
    }
    const hash = await bcrypt.hash(nextPass, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, password_must_change = 0 WHERE id = ?',
      [hash, req.session.userId]
    );
    req.session.passwordMustChange = false;
    await log({ userId: req.session.userId, action: 'PASSWORD_CHANGED', details: 'User set new password', req });
    res.redirect('/?onboarding=profile');
  } catch (err) {
    console.error(err);
    res.redirect('/account/change-password?message=' + encodeURIComponent('Could not update password.') + '&error=1');
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = safeParseLogin(req.body);
  if (!parsed.ok) {
    await log({ action: 'LOGIN_FAILURE', details: parsed.error, req });
    return res.redirect(`/login?message=${encodeURIComponent(parsed.error)}&error=1`);
  }
  const emailTrim = parsed.data.email;
  const pass = parsed.data.password;

  try {
    const [rows] = await pool.query(
      `SELECT id, email, password_hash, full_name, preferred_name, role, is_active, two_factor_enabled,
              COALESCE(password_must_change, 0) AS password_must_change,
              COALESCE(profile_completed, 1) AS profile_completed,
              company_id
       FROM users WHERE email = ? LIMIT 1`,
      [emailTrim]
    );
    const user = rows[0];
    if (!user) {
      await log({ action: 'LOGIN_FAILURE', details: `Unknown email: ${emailTrim}`, req });
      return res.redirect(`/login?message=${encodeURIComponent('Invalid email or password.')}&error=1`);
    }
    if (!user.is_active) {
      await log({ action: 'LOGIN_FAILURE', details: `Deactivated account: ${emailTrim}`, req });
      return res.redirect(`/login?message=${encodeURIComponent('Account is deactivated.')}&error=1`);
    }
    const match = await bcrypt.compare(pass, user.password_hash);
    if (!match) {
      await log({ action: 'LOGIN_FAILURE', details: `Wrong password: ${emailTrim}`, req });
      return res.redirect(`/login?message=${encodeURIComponent('Invalid email or password.')}&error=1`);
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
    res.redirect(postLoginRedirect());
  } catch (err) {
    console.error(err);
    await log({ action: 'LOGIN_FAILURE', details: err.message, req });
    res.redirect(`/login?message=${encodeURIComponent('Server error. Please try again.')}&error=1`);
  }
});

router.post('/register', (req, res) => {
  res.redirect('/login?message=' + encodeURIComponent('Registration is not available. Your administrator will create your account.'));
});

router.get('/forgot-password', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  return sendSpaOr503(res);
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const result = await requestPasswordResetEmail(req, req.body && req.body.email);
  if (!result.ok) {
    return res.redirect('/forgot-password?message=' + encodeURIComponent(result.error) + '&error=1');
  }
  res.redirect('/forgot-password?sent=1');
});

router.get('/reset-password/:token', async (req, res) => {
  const token = (req.params.token || '').trim();
  if (!token) return res.redirect('/forgot-password');
  try {
    const [rows] = await pool.query('SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()', [token]);
    if (rows.length === 0) {
      return res.redirect('/forgot-password?message=This reset link has expired or is invalid.');
    }
    return sendSpaOr503(res);
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
    return res.redirect(`/reset-password/${encodeURIComponent(token)}?message=${encodeURIComponent('Password must be at least 6 characters.')}&error=1`);
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
    res.redirect(`/reset-password/${encodeURIComponent(token)}?message=${encodeURIComponent('Failed to reset password.')}&error=1`);
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
