const path = require('path');
// Always load .env from the app folder (not from whatever directory the shell is in).
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
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
const apiAdminRoutes = require('./routes/api-admin');
const apiCompanyRoutes = require('./routes/api-company');
const { enforceOnboarding } = require('./middleware/onboarding');
const { sendSpaOr503 } = require('./lib/spa');
const { logSmtpStartupHint } = require('./lib/mail');

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'medsupply-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
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
      title: `${c.name} — add a client admin`,
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

app.use('/api/admin', apiAdminRoutes);
app.use('/api/company', apiCompanyRoutes);
app.use('/api', apiRoutes);
app.use('/', authRoutes);
app.use('/documents', documentRoutes);
app.use('/admin', adminRoutes);
app.use('/company', companyRoutes);

app.post('/profile', requireAuth, enforceOnboarding, async (req, res) => {
  const userId = req.session.userId;
  const { preferredName, phone, addressState, addressCity, addressSuburb, emergencyContactName, emergencyContactPhone, company } =
    req.body || {};
  const sysAdmin = isSystemAdmin(req.session.role);
  try {
    const pn = (preferredName || '').toString().trim().slice(0, 255) || null;
    const ph = (phone || '').toString().trim().slice(0, 50) || null;
    const st = (addressState || '').toString().trim().slice(0, 100) || null;
    const city = (addressCity || '').toString().trim().slice(0, 100) || null;
    const suburb = (addressSuburb || '').toString().trim().slice(0, 100) || null;
    const ecn = (emergencyContactName || '').toString().trim().slice(0, 255) || null;
    const ecp = (emergencyContactPhone || '').toString().trim().slice(0, 50) || null;

    if (sysAdmin) {
      await pool.query(
        `UPDATE users SET preferred_name = ?, phone = ?, state = ?, city = ?, suburb = ?, emergency_contact_name = ?, emergency_contact_phone = ?, profile_completed = 1 WHERE id = ?`,
        [pn, ph, st, city, suburb, ecn, ecp, userId]
      );
    } else {
      let companyVal = (company || '').toString().trim().slice(0, 255) || null;
      if (req.session.companyId) {
        const [[coRow]] = await pool.query('SELECT name FROM companies WHERE id = ?', [req.session.companyId]);
        if (coRow && coRow.name) companyVal = coRow.name;
      }
      await pool.query(
        `UPDATE users SET preferred_name = ?, phone = ?, state = ?, city = ?, suburb = ?, emergency_contact_name = ?, emergency_contact_phone = ?, company = ?, profile_completed = 1 WHERE id = ?`,
        [pn, ph, st, city, suburb, ecn, ecp, companyVal, userId]
      );
    }
    req.session.profileCompleted = true;
    req.session.preferredName = pn || null;
    res.redirect('/profile?saved=1');
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.redirect('/?profile=need-migration');
    }
    console.error(err);
    res.redirect('/profile?error=save');
  }
});

app.get('/settings/2fa', requireAuth, enforceOnboarding, (req, res) => sendSpaOr503(res));

app.post('/settings/2fa/enable', requireAuth, enforceOnboarding, async (req, res) => {
  try {
    const { secret, otpauth } = generateSecret(req.session.email || 'user');
    req.session.temp2FASecret = { secret, otpauth };
    res.redirect('/settings/2fa');
  } catch (err) {
    console.error(err);
    res.redirect('/settings/2fa?error=setup');
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
    res.redirect('/settings/2fa?error=enable');
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
    res.redirect('/settings/2fa?error=disable');
  }
});

const clientDist = path.join(__dirname, 'client', 'dist');
const spaIndexPath = path.join(clientDist, 'index.html');
if (fs.existsSync(spaIndexPath)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(spaIndexPath, (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.redirect('/documents/upload?error=' + encodeURIComponent('File too large. Max size is 10MB.'));
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.redirect('/documents/upload?error=' + encodeURIComponent(err.message));
  }
  console.error(err);
  res.status(500).type('text').send(err.message || 'Something went wrong.');
});

const { ensureDocumentTypeColumn } = require('./lib/migrate-document-type');
const { ensureFileTypeColumnSize } = require('./lib/migrate-file-type');
const { ensureTwoFactorColumns } = require('./lib/migrate-two-factor');
const { ensureRolesAndCompanies } = require('./lib/migrate-roles-companies');
const { ensureDocumentApprovalColumn } = require('./lib/migrate-document-approval');
const { ensureNotificationReads } = require('./lib/migrate-notification-reads');
const { ensureUserPhoneColumn } = require('./lib/migrate-user-phone');
const { ensureDocumentRejectionReasonColumn } = require('./lib/migrate-document-rejection-reason');
const { ensureUserAvatarColumn } = require('./lib/migrate-user-avatar');

(async function runMigrationsThenListen() {
  try {
    await ensureDocumentTypeColumn();
    await ensureFileTypeColumnSize();
    await ensureTwoFactorColumns();
    await ensureRolesAndCompanies();
    await ensureDocumentApprovalColumn();
    await ensureDocumentRejectionReasonColumn();
    await ensureNotificationReads();
    await ensureUserPhoneColumn();
    await ensureUserAvatarColumn();
  } catch (err) {
    console.warn('Migration:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`MedSupply Portal running at http://localhost:${PORT}`);
    logSmtpStartupHint();
  });
})();
