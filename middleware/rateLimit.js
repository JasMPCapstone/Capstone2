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
      return res.status(options.statusCode).render('login-2fa', {
        token: (req.body && req.body.token) || (req.query && req.query.token) || '',
        message: msg,
        alertType: 'error',
      });
    }
    res.status(options.statusCode).render('login', {
      message: msg,
      alertType: 'error',
    });
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
    res.status(429).render('forgot-password', {
      message: 'Too many requests. Please try again later.',
      alertType: 'error',
    });
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
    const locals = { message: 'Too many uploads in a short period. Please try again later.', navActive: 'upload' };
    if (req.session && req.session.role && isSystemAdmin(req.session.role)) {
      locals.adminPageTitle = 'Upload document';
    }
    res.status(429).render('documents/upload', locals);
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
