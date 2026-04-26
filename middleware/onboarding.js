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
      p === '/' ||
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
    return res.redirect('/profile');
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

/** JSON API: return 403 + redirect hint instead of HTML redirect (SPA clients). */
function enforceOnboardingApi(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }
  const role = req.session.role;
  if (isSystemAdmin(role)) {
    return next();
  }

  if (req.session.passwordMustChange) {
    return res.status(403).json({
      error: 'Password change required',
      code: 'ONBOARDING',
      redirect: '/account/change-password',
    });
  }

  if (!req.session.profileCompleted) {
    return res.status(403).json({
      error: 'Profile completion required',
      code: 'ONBOARDING',
      redirect: '/profile',
    });
  }

  if (mustEnforceFullOnboarding(role) && !req.session.twoFactorEnabled) {
    const p = pathOnly(req);
    if (p.startsWith('/api/settings/2fa')) {
      return next();
    }
    return res.status(403).json({
      error: 'Two-factor authentication required',
      code: 'ONBOARDING',
      redirect: '/settings/2fa?style=required',
    });
  }

  next();
}

module.exports = { enforceOnboarding, enforceOnboardingApi };
