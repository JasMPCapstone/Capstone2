const { log } = require('../lib/audit');

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

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'ADMIN') {
    return res.status(403).render('error', { message: 'Admin access required.' });
  }
  if (req.session.userActive === false) {
    req.session.destroy(() => {});
    return res.redirect('/login?message=Account deactivated');
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
