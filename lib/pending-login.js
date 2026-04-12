/**
 * In-memory store for pending 2FA logins.
 * Maps a short-lived token to user data after password verification.
 * For multi-server deployment, use Redis or a database table instead.
 */
const crypto = require('crypto');

const store = new Map();
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function create(userId, email, fullName, role, userActive, opts = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  store.set(token, {
    userId,
    email,
    fullName,
    role,
    userActive,
    passwordMustChange: !!opts.passwordMustChange,
    profileCompleted: !!opts.profileCompleted,
    twoFactorEnabled: !!opts.twoFactorEnabled,
    companyId: opts.companyId != null ? opts.companyId : null,
    expiresAt: Date.now() + EXPIRY_MS,
  });
  return token;
}

function get(token) {
  const entry = store.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) store.delete(token);
    return null;
  }
  return {
    userId: entry.userId,
    email: entry.email,
    fullName: entry.fullName,
    role: entry.role,
    userActive: entry.userActive,
    passwordMustChange: !!entry.passwordMustChange,
    profileCompleted: !!entry.profileCompleted,
    twoFactorEnabled: !!entry.twoFactorEnabled,
    companyId: entry.companyId != null ? entry.companyId : null,
  };
}

function consume(token) {
  const data = get(token);
  if (data) store.delete(token);
  return data;
}

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [tok, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(tok);
  }
}, 60000); // every minute

module.exports = { create, consume, get };
