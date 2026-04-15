const { isSystemAdmin, isClientAdmin } = require('../lib/roles');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.userActive === false) {
    req.session.destroy(() => {});
    return res.redirect('/login?message=Account deactivated');
  }
  next();
}

function requireSystemAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (!isSystemAdmin(req.session.role)) {
    return res.status(403).render('error', { message: 'System administrator access required.' });
  }
  if (req.session.userActive === false) {
    req.session.destroy(() => {});
    return res.redirect('/login?message=Account deactivated');
  }
  next();
}

/** @deprecated use requireSystemAdmin */
const requireAdmin = requireSystemAdmin;

function requireClientAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (!isClientAdmin(req.session.role)) {
    return res.status(403).render('error', { message: 'Manager access required.' });
  }
  if (req.session.userActive === false) {
    req.session.destroy(() => {});
    return res.redirect('/login?message=Account deactivated');
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSystemAdmin, requireClientAdmin };
