const { isSystemAdmin, isClientAdmin } = require('../lib/roles');

function requireApiSession(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.userActive === false) {
    return res.status(401).json({ error: 'Account deactivated' });
  }
  next();
}

function requireApiSystemAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!isSystemAdmin(req.session.role)) {
    return res.status(403).json({ error: 'System administrator access required' });
  }
  next();
}

function requireApiClientAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!isClientAdmin(req.session.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

module.exports = { requireApiSession, requireApiSystemAdmin, requireApiClientAdmin };
