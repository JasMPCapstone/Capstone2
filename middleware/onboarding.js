const { isSystemAdmin, mustEnforceFullOnboarding } = require('../lib/roles');

function pathOnly(req) {
  return (req.originalUrl || req.url || '').split('?')[0];
}

function enforceOnboarding(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }
  const role = req.session.role;
  if (isSystemAdmin(role)) {
    return next();
  }

  const p = pathOnly(req);

  if (req.session.passwordMustChange) {
    if (p.startsWith('/account/change-password') || (p === '/logout' && req.method === 'POST')) {
      return next();
    }
    return res.redirect('/account/change-password');
  }

  if (!req.session.profileCompleted) {
    if (
      p === '/dashboard' ||
      p === '/profile' ||
      p === '/help' ||
      p === '/privacy' ||
      p.startsWith('/account/change-password')
    ) {
      return next();
    }
    if (req.method === 'POST' && p === '/profile') {
      return next();
    }
    return res.redirect('/dashboard?onboarding=profile');
  }

  if (mustEnforceFullOnboarding(role) && !req.session.twoFactorEnabled) {
    if (p.startsWith('/settings/2fa') || (p === '/logout' && req.method === 'POST')) {
      return next();
    }
    if (req.method === 'POST' && p.startsWith('/settings/2fa')) {
      return next();
    }
    return res.redirect('/settings/2fa?style=required');
  }

  next();
}

module.exports = { enforceOnboarding };
