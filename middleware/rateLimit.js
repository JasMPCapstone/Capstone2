const rateLimit = require('express-rate-limit');
const { log } = require('../lib/audit');
const { isSystemAdmin } = require('../lib/roles');

function onLimitReached(req) {
  log({
    action: 'RATE_LIMIT_HIT',
    details: `${req.method} ${req.originalUrl || req.url}`,
    req,
  }).catch(() => {});
}

/** Strict limit for login and 2FA credential posts */
const authLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_AUTH_MAX ? parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res, next, options) => {
    onLimitReached(req);
    if (req.path && req.path.includes('/api/')) {
      return res.status(options.statusCode).json({ error: 'Too many attempts. Try again later.' });
    }
    const msg = 'Too many sign-in attempts. Please wait a few minutes and try again.';
    if ((req.path || '').includes('/login/2fa')) {
      const token = ((req.body && req.body.token) || (req.query && req.query.token) || '').toString().trim();
      return res.redirect(
        `/login/2fa?token=${encodeURIComponent(token)}&message=${encodeURIComponent(msg)}&error=1`
      );
    }
    return res.redirect(`/login?message=${encodeURIComponent(msg)}&error=1`);
  },
});

/** Password reset request */
const authForgot = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.RATE_LIMIT_FORGOT_MAX ? parseInt(process.env.RATE_LIMIT_FORGOT_MAX, 10) : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached(req);
    const msg = 'Too many requests. Please try again later.';
    if ((req.originalUrl || '').startsWith('/api/')) {
      return res.status(429).json({ error: msg });
    }
    res.redirect('/forgot-password?message=' + encodeURIComponent(msg));
  },
});

/** Document uploads (authenticated) */
const documentUpload = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.RATE_LIMIT_UPLOAD_MAX ? parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10) : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    onLimitReached(req);
    const msg = 'Too many uploads in a short period. Please try again later.';
    return res.redirect('/documents/upload?error=' + encodeURIComponent(msg));
  },
});

/** General API JSON routes */
const apiGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_API_MAX ? parseInt(process.env.RATE_LIMIT_API_MAX, 10) : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    onLimitReached(req);
    res.status(429).json({ error: 'Too many requests. Try again later.' });
  },
});

module.exports = {
  authLogin,
  authForgot,
  documentUpload,
  apiGeneral,
};
