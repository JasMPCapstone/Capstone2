require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const { requireAuth } = require('./middleware/auth');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

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
    };
  } else {
    res.locals.user = null;
  }
  next();
});

app.use('/', authRoutes);
app.use('/documents', documentRoutes);
app.use('/admin', adminRoutes);

// Client dashboard (admins go to /admin)
app.get('/dashboard', requireAuth, async (req, res) => {
  if (req.session.role === 'ADMIN') return res.redirect('/admin');
  try {
    const userId = req.session.userId;
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM documents WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );
    const [recent] = await pool.query(
      'SELECT id, title, original_filename, file_extension, file_size, created_at, description FROM documents WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    let profile = null;
    try {
      const [userRows] = await pool.query(
        'SELECT email, full_name, preferred_name, given_name, last_name, state, city, suburb, emergency_contact_name, emergency_contact_phone, company FROM users WHERE id = ?',
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
    res.render('dashboard', { totalDocs: total || 0, recentDocs: recent || [], profile: profile || {}, profileUpdated: req.query.profile === 'updated', needMigration: req.query.profile === 'need-migration', navActive: 'dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load dashboard.' });
  }
});

app.post('/profile', requireAuth, async (req, res) => {
  if (req.session.role === 'ADMIN') return res.redirect('/admin');
  const userId = req.session.userId;
  const { preferredName, addressState, addressCity, addressSuburb, emergencyContactName, emergencyContactPhone, company } = req.body || {};
  try {
    await pool.query(
      `UPDATE users SET preferred_name = ?, state = ?, city = ?, suburb = ?, emergency_contact_name = ?, emergency_contact_phone = ?, company = ? WHERE id = ?`,
      [
        (preferredName || '').toString().trim().slice(0, 255) || null,
        (addressState || '').toString().trim().slice(0, 100) || null,
        (addressCity || '').toString().trim().slice(0, 100) || null,
        (addressSuburb || '').toString().trim().slice(0, 100) || null,
        (emergencyContactName || '').toString().trim().slice(0, 255) || null,
        (emergencyContactPhone || '').toString().trim().slice(0, 50) || null,
        (company || '').toString().trim().slice(0, 255) || null,
        userId,
      ]
    );
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
    return res.redirect(req.session.role === 'ADMIN' ? '/admin' : '/dashboard');
  }
  res.redirect('/login');
});

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

Promise.all([ensureDocumentTypeColumn(), ensureFileTypeColumnSize()])
  .catch((err) => console.warn('Migration:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`MedSupply Portal running at http://localhost:${PORT}`);
    });
  });
