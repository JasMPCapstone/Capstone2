require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const multer = require('multer');

const bcrypt = require('bcryptjs');
const { requireAuth } = require('./middleware/auth');
const { pool } = require('./config/database');
const { log } = require('./lib/audit');
const authRoutes = require('./routes/auth');
const { generateSecret, verifyToken, getQRDataURL } = require('./lib/twofactor');
const { isSystemAdmin, isClientAdmin } = require('./lib/roles');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/company');
const apiRoutes = require('./routes/api');
const { enforceOnboarding } = require('./middleware/onboarding');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'medsupply-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    res.locals.user = {
      userId: req.session.userId,
      email: req.session.email,
      fullName: req.session.fullName,
      role: req.session.role,
      companyId: req.session.companyId,
    };
    res.locals.isSystemAdmin = isSystemAdmin(req.session.role);
    res.locals.isClientAdmin = isClientAdmin(req.session.role);
  } else {
    res.locals.user = null;
    res.locals.isSystemAdmin = false;
    res.locals.isClientAdmin = false;
  }
  res.locals.adminNotifyPending = 0;
  res.locals.adminNotifyOnboarding = 0;
  res.locals.adminNotifyFeed = [];
  res.locals.adminRecentPendingDocs = [];
  res.locals.adminOnboardingCompanies = [];
  res.locals.adminNotifySuppressed = false;
  res.locals.adminNotifyBadgeTotal = 0;
  next();
});

function adminShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildAdminNotifyFeed(docRows, companyRows) {
  const items = [];
  (docRows || []).forEach((d) => {
    const rawTitle = (d.title || d.original_filename || 'Document').toString().trim() || 'Untitled document';
    const title = rawTitle.length > 88 ? `${rawTitle.slice(0, 85)}…` : rawTitle;
    const meta = [d.company_name || '—', adminShortDate(d.created_at)].filter(Boolean).join(' · ');
    items.push({
      sort: new Date(d.created_at).getTime(),
      href: `/documents/${d.id}`,
      title,
      meta,
    });
  });
  (companyRows || []).forEach((c) => {
    items.push({
      sort: new Date(c.created_at).getTime(),
      href: `/admin/companies/${c.id}/admins/new`,
      title: `${c.name} — add a manager`,
      meta: `${adminShortDate(c.created_at)}`,
    });
  });
  items.sort((a, b) => b.sort - a.sort);
  return items.slice(0, 10).map(({ title, meta, href }) => ({ title, meta, href }));
}

app.use(async (req, res, next) => {
  if (!req.session || !req.session.userId || !res.locals.isSystemAdmin) {
    return next();
  }
  try {
    try {
      const [[row]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL AND approval_status = 'PENDING'`
      );
      res.locals.adminNotifyPending = row.c;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    }
    const [[row2]] = await pool.query(
      `SELECT COUNT(*) AS c FROM companies co
       WHERE NOT EXISTS (
         SELECT 1 FROM users u WHERE u.company_id = co.id AND u.role = 'CLIENT_ADMIN' AND u.is_active = 1
       )`
    );
    res.locals.adminNotifyOnboarding = row2.c;

    let docRows = [];
    try {
      const [rows] = await pool.query(
        `SELECT d.id, d.title, d.original_filename, d.created_at, c.name AS company_name,
                u.company_id, u.full_name AS uploader_name, u.email AS uploader_email
         FROM documents d
         INNER JOIN users u ON u.id = d.user_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE d.deleted_at IS NULL AND d.approval_status = 'PENDING'
         ORDER BY d.created_at DESC
         LIMIT 8`
      );
      docRows = rows;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    }

    const [companyRows] = await pool.query(
      `SELECT co.id, co.name, co.created_at
       FROM companies co
       WHERE NOT EXISTS (
         SELECT 1 FROM users u WHERE u.company_id = co.id AND u.role = 'CLIENT_ADMIN' AND u.is_active = 1
       )
       ORDER BY co.created_at DESC
       LIMIT 8`
    );

    res.locals.adminRecentPendingDocs = docRows;
    res.locals.adminOnboardingCompanies = companyRows;
    res.locals.adminNotifyFeed = buildAdminNotifyFeed(docRows, companyRows);

    const p = res.locals.adminNotifyPending;
    const o = res.locals.adminNotifyOnboarding;
    const snap = req.session && req.session.adminNotifyDismissedAtCounts;
    res.locals.adminNotifySuppressed = !!(snap && snap.pending === p && snap.onboarding === o);
    if (res.locals.adminNotifySuppressed) {
      res.locals.adminNotifyFeed = [];
    }
    res.locals.adminNotifyBadgeTotal = res.locals.adminNotifySuppressed ? 0 : p + o;
  } catch (err) {
    console.warn('Admin notification counts:', err.message);
    const p = res.locals.adminNotifyPending;
    const o = res.locals.adminNotifyOnboarding;
    res.locals.adminNotifyBadgeTotal = p + o;
    res.locals.adminNotifySuppressed = false;
  }
  next();
});

app.use('/api', apiRoutes);
app.use('/', authRoutes);
app.use('/documents', documentRoutes);
app.use('/admin', adminRoutes);
app.use('/company', companyRoutes);

app.get('/dashboard', requireAuth, enforceOnboarding, async (req, res) => {
  if (isSystemAdmin(req.session.role)) return res.redirect('/admin');
  try {
    const userId = req.session.userId;
    const companyId = req.session.companyId;
    let total = 0;
    let recent = [];
    if (isClientAdmin(req.session.role) && companyId) {
      const [[t]] = await pool.query(
        `SELECT COUNT(*) AS total FROM documents d
         INNER JOIN users u ON u.id = d.user_id
         WHERE u.company_id = ? AND d.deleted_at IS NULL`,
        [companyId]
      );
      total = t.total || 0;
      [recent] = await pool.query(
        `SELECT d.id, d.title, d.original_filename, d.file_extension, d.file_size, d.created_at, d.description
         FROM documents d
         INNER JOIN users u ON u.id = d.user_id
         WHERE u.company_id = ? AND d.deleted_at IS NULL
         ORDER BY d.created_at DESC LIMIT 5`,
        [companyId]
      );
    } else {
      const [[t]] = await pool.query(
        'SELECT COUNT(*) AS total FROM documents WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
      );
      total = t.total || 0;
      [recent] = await pool.query(
        'SELECT id, title, original_filename, file_extension, file_size, created_at, description FROM documents WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5',
        [userId]
      );
    }
    let profile = null;
    try {
      const [userRows] = await pool.query(
        `SELECT u.email, u.full_name, u.preferred_name, u.given_name, u.last_name, u.state, u.city, u.suburb,
                u.emergency_contact_name, u.emergency_contact_phone, u.company, u.company_id, c.name AS organization_name
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = ?`,
        [userId]
      );
      profile = userRows[0] || null;
    } catch (_) {
      try {
        const [userRows] = await pool.query(
          'SELECT email, full_name, preferred_name, state, city, suburb, emergency_contact_name, emergency_contact_phone, company FROM users WHERE id = ?',
          [userId]
        );
        profile = userRows[0] || null;
      } catch (__) {
        const [userRows] = await pool.query('SELECT email, full_name FROM users WHERE id = ?', [userId]);
        profile = userRows[0] || null;
      }
    }
    if (profile && (profile.state !== undefined || profile.suburb !== undefined || profile.city !== undefined)) {
      profile.address_state = profile.state;
      profile.address_city = profile.city;
      profile.address_suburb = profile.suburb;
    }
    if (profile && !profile.given_name && profile.full_name) {
      const parts = profile.full_name.trim().split(/\s+/);
      profile.given_name = parts[0] || profile.full_name;
      profile.last_name = parts.slice(1).join(' ') || '';
    }
    if (profile && req.session.companyId && !isSystemAdmin(req.session.role)) {
      profile.showOrgReadonly = true;
    }
    res.render('dashboard', {
      totalDocs: total || 0,
      recentDocs: recent || [],
      profile: profile || {},
      profileUpdated: req.query.profile === 'updated',
      needMigration: req.query.profile === 'need-migration',
      onboardingProfile: req.query.onboarding === 'profile',
      navActive: 'dashboard',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load dashboard.' });
  }
});

app.post('/profile', requireAuth, enforceOnboarding, async (req, res) => {
  if (isSystemAdmin(req.session.role)) return res.redirect('/admin');
  const userId = req.session.userId;
  const { preferredName, addressState, addressCity, addressSuburb, emergencyContactName, emergencyContactPhone, company } =
    req.body || {};
  try {
    let companyVal = (company || '').toString().trim().slice(0, 255) || null;
    if (req.session.companyId) {
      const [[coRow]] = await pool.query('SELECT name FROM companies WHERE id = ?', [req.session.companyId]);
      if (coRow && coRow.name) companyVal = coRow.name;
    }
    await pool.query(
      `UPDATE users SET preferred_name = ?, state = ?, city = ?, suburb = ?, emergency_contact_name = ?, emergency_contact_phone = ?, company = ?, profile_completed = 1 WHERE id = ?`,
      [
        (preferredName || '').toString().trim().slice(0, 255) || null,
        (addressState || '').toString().trim().slice(0, 100) || null,
        (addressCity || '').toString().trim().slice(0, 100) || null,
        (addressSuburb || '').toString().trim().slice(0, 100) || null,
        (emergencyContactName || '').toString().trim().slice(0, 255) || null,
        (emergencyContactPhone || '').toString().trim().slice(0, 50) || null,
        companyVal,
        userId,
      ]
    );
    req.session.profileCompleted = true;
    res.redirect('/dashboard?profile=updated');
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.redirect('/dashboard?profile=need-migration');
    }
    console.error(err);
    res.status(500).render('error', { message: 'Failed to update profile.' });
  }
});

app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(isSystemAdmin(req.session.role) ? '/admin' : '/dashboard');
  }
  res.redirect('/login');
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { navActive: null });
});

app.get('/help', (req, res) => {
  const helpLocals = { navActive: 'help' };
  if (req.session && req.session.userId && isSystemAdmin(req.session.role)) {
    helpLocals.adminPageTitle = 'Help';
  }
  res.render('help', helpLocals);
});

app.get('/settings/2fa', requireAuth, enforceOnboarding, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT two_factor_enabled FROM users WHERE id = ?', [req.session.userId]);
    const enabled = rows[0] && rows[0].two_factor_enabled;
    const tempSecret = req.session.temp2FASecret;
    let qrDataURL = null;
    let manualSecret = null;
    if (tempSecret) {
      qrDataURL = await getQRDataURL(tempSecret.otpauth);
      manualSecret = tempSecret.secret;
    }
    const tfaLocals = {
      twoFactorEnabled: !!enabled,
      qrDataURL,
      manualSecret,
      query: req.query,
      require2FA: req.query.style === 'required',
      navActive: 'settings',
    };
    if (isSystemAdmin(req.session.role)) tfaLocals.adminPageTitle = 'Two-factor authentication';
    res.render('settings/2fa', tfaLocals);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load settings.' });
  }
});

app.post('/settings/2fa/enable', requireAuth, enforceOnboarding, async (req, res) => {
  try {
    const { secret, otpauth } = generateSecret(req.session.email || 'user');
    req.session.temp2FASecret = { secret, otpauth };
    res.redirect('/settings/2fa');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to start 2FA setup.' });
  }
});

app.post('/settings/2fa/verify', requireAuth, enforceOnboarding, async (req, res) => {
  const code = (req.body.code || '').toString().trim().replace(/\s/g, '');
  const tempSecret = req.session.temp2FASecret;
  if (!tempSecret || !code) {
    return res.redirect('/settings/2fa?error=missing');
  }
  if (!verifyToken(tempSecret.secret, code)) {
    return res.redirect('/settings/2fa?error=invalid');
  }
  try {
    await pool.query(
      'UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1 WHERE id = ?',
      [tempSecret.secret, req.session.userId]
    );
    delete req.session.temp2FASecret;
    req.session.twoFactorEnabled = true;
    await log({ userId: req.session.userId, action: '2FA_ENABLED', details: req.session.email, req });
    res.redirect('/settings/2fa?enabled=1');
  } catch (err) {
    console.error(err);
    delete req.session.temp2FASecret;
    res.status(500).render('error', { message: 'Failed to enable 2FA.' });
  }
});

app.post('/settings/2fa/cancel', requireAuth, enforceOnboarding, (req, res) => {
  delete req.session.temp2FASecret;
  res.redirect('/settings/2fa');
});

app.post('/settings/2fa/disable', requireAuth, enforceOnboarding, async (req, res) => {
  const password = (req.body.password || '').toString();
  if (!password) {
    return res.redirect('/settings/2fa?error=password');
  }
  try {
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.session.userId]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.redirect('/settings/2fa?error=wrongpassword');
    }
    await pool.query(
      'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?',
      [req.session.userId]
    );
    req.session.twoFactorEnabled = false;
    await log({ userId: req.session.userId, action: '2FA_DISABLED', details: req.session.email, req });
    res.redirect('/settings/2fa?disabled=1');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to disable 2FA.' });
  }
});

if (process.env.SERVE_SPA === '1') {
  const clientDist = path.join(__dirname, 'client', 'dist');
  app.use('/app', express.static(clientDist));
  app.get(/^\/app(\/.*)?$/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('documents/upload', { message: 'File too large. Max size is 10MB.', navActive: 'upload' });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).render('documents/upload', { message: err.message, navActive: 'upload' });
  }
  console.error(err);
  res.status(500).render('error', { message: err.message || 'Something went wrong.' });
});

const { ensureDocumentTypeColumn } = require('./lib/migrate-document-type');
const { ensureFileTypeColumnSize } = require('./lib/migrate-file-type');
const { ensureTwoFactorColumns } = require('./lib/migrate-two-factor');
const { ensureRolesAndCompanies } = require('./lib/migrate-roles-companies');
const { ensureDocumentApprovalColumn } = require('./lib/migrate-document-approval');

(async function runMigrationsThenListen() {
  try {
    await ensureDocumentTypeColumn();
    await ensureFileTypeColumnSize();
    await ensureTwoFactorColumns();
    await ensureRolesAndCompanies();
    await ensureDocumentApprovalColumn();
  } catch (err) {
    console.warn('Migration:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`MedSupply Portal running at http://localhost:${PORT}`);
  });
})();
