const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const uploadDir = path.join(process.cwd(), 'uploads');
const { getStorage, isS3Storage } = require('../lib/storage');
const { log } = require('../lib/audit');
const { requireAuth, requireSystemAdmin } = require('../middleware/auth');
const { normalizeApprovalStatus } = require('../lib/migrate-document-approval');
const { sendSpaOr503 } = require('../lib/spa');

const router = express.Router();
router.use(requireAuth);
router.use(requireSystemAdmin);

/** SPA list URLs after user-management merge */
const ADMIN_ORG_LIST = '/admin/user-management/organizations';
const ADMIN_USER_LIST = '/admin/user-management/users';
const adminOrgDetail = (id) => `/admin/user-management/organizations/${id}`;

// Dismiss bell badge + dropdown until pending/onboarding counts change
router.post('/notifications/clear', async (req, res) => {
  try {
    let pending = 0;
    try {
      const [[row]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL AND approval_status = 'PENDING'`
      );
      pending = row.c;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    }
    const [[row2]] = await pool.query(
      `SELECT COUNT(*) AS c FROM companies co
       WHERE NOT EXISTS (
         SELECT 1 FROM users u WHERE u.company_id = co.id AND u.role = 'CLIENT_ADMIN' AND u.is_active = 1
       )`
    );
    const onboarding = row2.c;
    req.session.adminNotifyDismissedAtCounts = { pending, onboarding };
  } catch (err) {
    console.error(err);
  }
  const back = (req.get('Referrer') || '/').toString();
  const safe = back.startsWith('/') ? back : '/';
  res.redirect(safe);
});

router.get('/', (req, res) => sendSpaOr503(res));

router.get('/user-management', (req, res) => sendSpaOr503(res));
router.get('/user-management/organizations', (req, res) => sendSpaOr503(res));
router.get('/user-management/organizations/:id', (req, res) => sendSpaOr503(res));
router.get('/user-management/users', (req, res) => sendSpaOr503(res));
router.get('/user-management/users/:id', (req, res) => sendSpaOr503(res));
router.get('/user-management/roles', (req, res) => sendSpaOr503(res));

router.get('/roles', (req, res) => sendSpaOr503(res));

router.get('/users/new', (req, res) => sendSpaOr503(res));

router.post('/users', async (req, res) => {
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();
  const roleRaw = (req.body.role || '').toString();
  const companyId = parseInt(req.body.companyId, 10);

  const redirectForm = (msg) => {
    const p = new URLSearchParams();
    if (msg) p.set('message', msg);
    if (!Number.isNaN(companyId) && companyId > 0) p.set('companyId', String(companyId));
    const qs = p.toString();
    return res.redirect(`/admin/users/new${qs ? `?${qs}` : ''}`);
  };

  const redirectList = (msg, extra) => {
    const p = new URLSearchParams();
    if (msg) p.set('message', msg);
    if (extra && extra.companyId) p.set('companyId', String(extra.companyId));
    const qs = p.toString();
    return res.redirect(`${ADMIN_USER_LIST}${qs ? `?${qs}` : ''}`);
  };

  if (!companyId || Number.isNaN(companyId)) {
    return redirectForm('Choose a company');
  }
  if (!emailTrim || !fullName || !tempPassword || tempPassword.length < 6) {
    return redirectForm('Fill all fields; password at least 6 characters');
  }
  let role = roleRaw === 'CLIENT_ADMIN' ? 'CLIENT_ADMIN' : 'CLIENT';
  if (role !== 'CLIENT_ADMIN' && role !== 'CLIENT') {
    return redirectForm('Invalid role');
  }
  if (role === 'CLIENT') {
    return redirectForm('Add clients from Organization management → open the organization → Add client.');
  }
  role = 'CLIENT_ADMIN';
  try {
    const [cc] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [companyId]);
    if (!cc.length) return redirectForm('Company not found');
    const orgName = cc[0].name;
    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?)`,
      [emailTrim, hash, fullName, role, companyId, orgName]
    );
    await log({
      userId: req.session.userId,
      action: 'SYSTEM_CREATE_USER',
      details: `email=${emailTrim} company_id=${companyId} role=${role}`,
      req,
    });
    return redirectList('Client admin created', { companyId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return redirectForm('Email already in use');
    }
    console.error(err);
    return redirectForm('Could not create user');
  }
});

router.get('/users', (req, res) => sendSpaOr503(res));

// Deactivate user
router.post('/users/:id/deactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect(ADMIN_USER_LIST);
  if (id === req.session.userId) {
    return res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Cannot deactivate yourself')}`);
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect(ADMIN_USER_LIST);
    if (user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN') {
      const [[{ c }]] = await pool.query(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('SYSTEM_ADMIN','ADMIN') AND is_active = 1 AND id != ?",
        [id]
      );
      if (c < 1) {
        return res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Cannot deactivate the last system administrator')}`);
      }
    }
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_DEACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('User deactivated')}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Action failed')}`);
  }
});

// Reactivate user
router.post('/users/:id/reactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect(ADMIN_USER_LIST);
  try {
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect(ADMIN_USER_LIST);
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_REACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('User reactivated')}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Action failed')}`);
  }
});

// Permanently delete user (documents removed from disk; DB rows cascade)
router.post('/users/:id/delete', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect(ADMIN_USER_LIST);
  if (id === req.session.userId) {
    return res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('You cannot delete your own account')}`);
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const target = rows[0];
    if (!target) return res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('User not found')}`);
    if (target.role === 'SYSTEM_ADMIN' || target.role === 'ADMIN') {
      const [[{ c }]] = await pool.query(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('SYSTEM_ADMIN','ADMIN') AND id != ?",
        [id]
      );
      if (c < 1) {
        return res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Cannot delete the last system administrator')}`);
      }
    }
    const [docRows] = await pool.query('SELECT filename FROM documents WHERE user_id = ?', [id]);
    for (const d of docRows) {
      try {
        if (isS3Storage()) {
          await getStorage().deleteObject(d.filename);
        } else {
          const fp = path.join(uploadDir, d.filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      } catch (e) {
        console.error(e);
      }
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_DELETE',
      details: `user_id=${id} email=${target.email}`,
      req,
    });
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('User permanently deleted')}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Could not delete user')}`);
  }
});

router.get('/users/:id/reset-password', (req, res) => sendSpaOr503(res));

// Reset password submit
router.post('/users/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const newPassword = (req.body.newPassword || '').toString();
  if (!id) return res.redirect(ADMIN_USER_LIST);
  if (newPassword.length < 6) {
    return res.redirect(`/admin/users/${id}/reset-password?message=Password must be at least 6 characters`);
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const targetUser = rows[0];
    if (!targetUser) return res.redirect(ADMIN_USER_LIST);
    const hash = await bcrypt.hash(newPassword, 10);
    if (targetUser.role === 'SYSTEM_ADMIN' || targetUser.role === 'ADMIN') {
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    } else {
      await pool.query(
        `UPDATE users SET password_hash = ?, password_must_change = 1, profile_completed = 0,
         two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?`,
        [hash, id]
      );
    }
    await log({
      userId: req.session.userId,
      action: 'ADMIN_PASSWORD_RESET',
      details: `user_id=${id} email=${targetUser.email}`,
      req,
    });
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Password reset successfully')}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${ADMIN_USER_LIST}?message=${encodeURIComponent('Reset failed')}`);
  }
});

router.get('/audit', (req, res) => sendSpaOr503(res));

router.get('/companies', (req, res) => sendSpaOr503(res));

router.post('/companies', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();

  const redirectForm = (msg) =>
    res.redirect('/admin/companies/new?message=' + encodeURIComponent(msg));

  if (!name) return redirectForm('Company name is required');
  if (!fullName || !emailTrim || !tempPassword || tempPassword.length < 6) {
    return redirectForm('Enter the client admin’s full name, email, and a temporary password (at least 6 characters).');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrim)) return redirectForm('Invalid email address');

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const companyName = name.slice(0, 255);
    const [cIns] = await conn.query('INSERT INTO companies (name) VALUES (?)', [companyName]);
    const companyId = cIns.insertId;
    const hash = await bcrypt.hash(tempPassword, 10);
    await conn.query(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT_ADMIN', ?, 1, 0, ?)`,
      [emailTrim, hash, fullName, companyId, companyName]
    );
    await conn.commit();
    await log({
      userId: req.session.userId,
      action: 'COMPANY_CREATE',
      details: `${companyName} company_id=${companyId}`,
      req,
    });
    await log({
      userId: req.session.userId,
      action: 'SYSTEM_CREATE_CLIENT_ADMIN',
      details: `email=${emailTrim} company_id=${companyId}`,
      req,
    });
    res.redirect(
      `${adminOrgDetail(companyId)}?message=${encodeURIComponent('Organization and client admin created.')}`
    );
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {
        console.error(rbErr);
      }
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return redirectForm('That email is already in use');
    }
    console.error(err);
    return redirectForm('Could not create organization and client admin');
  } finally {
    if (conn) conn.release();
  }
});

router.get('/companies/new', (req, res) => sendSpaOr503(res));

router.get('/companies/:id/users/new', (req, res) => sendSpaOr503(res));

router.post('/companies/:id/users', async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!companyId) return res.redirect(ADMIN_ORG_LIST);
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();

  const redirectForm = (msg) => {
    const q = msg ? `?message=${encodeURIComponent(msg)}` : '';
    return res.redirect(`/admin/companies/${companyId}/users/new${q}`);
  };

  if (!emailTrim || !fullName || !tempPassword || tempPassword.length < 6) {
    return redirectForm('Fill all fields; password at least 6 characters');
  }
  try {
    const [cc] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [companyId]);
    if (!cc.length)
      return res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Company not found')}`);
    const orgName = cc[0].name;
    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT', ?, 1, 0, ?)`,
      [emailTrim, hash, fullName, companyId, orgName]
    );
    await log({
      userId: req.session.userId,
      action: 'SYSTEM_CREATE_USER',
      details: `email=${emailTrim} company_id=${companyId} role=CLIENT`,
      req,
    });
    res.redirect(`${adminOrgDetail(companyId)}?message=${encodeURIComponent('Client user created.')}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return redirectForm('Email already in use');
    }
    console.error(err);
    return redirectForm('Could not create user');
  }
});

router.get('/companies/:id', (req, res) => sendSpaOr503(res));

router.post('/companies/:id/delete', async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!companyId) {
    return res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Invalid company.')}`);
  }

  let conn;
  try {
    const [[company]] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [companyId]);
    if (!company) {
      return res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Company not found.')}`);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [docRows] = await conn.query(
      `SELECT d.filename FROM documents d
       INNER JOIN users u ON u.id = d.user_id
       WHERE u.company_id = ?`,
      [companyId]
    );

    for (const row of docRows) {
      try {
        if (isS3Storage()) {
          await getStorage().deleteObject(row.filename);
        } else {
          const fp = path.join(uploadDir, row.filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      } catch (e) {
        console.warn('Company delete: could not remove file', row.filename, e.message);
      }
    }

    await conn.query('DELETE FROM users WHERE company_id = ?', [companyId]);
    await conn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await conn.commit();

    await log({
      userId: req.session.userId,
      action: 'COMPANY_DELETE',
      details: `company_id=${companyId} name=${company.name}`,
      req,
    });

    res.redirect(
      `${ADMIN_ORG_LIST}?message=` +
        encodeURIComponent(`Company “${company.name}” and all related users and documents have been removed.`)
    );
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error(e);
      }
    }
    console.error(err);
    res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Could not delete company.')}`);
  } finally {
    if (conn) conn.release();
  }
});

function redirectAfterDocumentApproval(req, res, companyId, message) {
  const r = (req.body.redirect || '').toString().trim();
  if (r === '/admin') {
    return res.redirect(`/?message=${encodeURIComponent(message)}`);
  }
  if (r === '/' || r === '/dashboard') {
    return res.redirect(`/?message=${encodeURIComponent(message)}`);
  }
  return res.redirect(`${adminOrgDetail(companyId)}?message=${encodeURIComponent(message)}`);
}

router.post('/companies/:companyId/documents/:docId/approval', async (req, res) => {
  const companyId = parseInt(req.params.companyId, 10);
  const docId = parseInt(req.params.docId, 10);
  const status = normalizeApprovalStatus(req.body.approval_status);
  const rejectionReason = (req.body.rejectionReason || '').toString().trim().slice(0, 4000);
  if (!companyId || !docId) return res.redirect(ADMIN_ORG_LIST);
  if (status === 'REJECTED' && !rejectionReason) {
    return redirectAfterDocumentApproval(req, res, companyId, 'Please provide a reason when rejecting a document.');
  }
  try {
    const [rows] = await pool.query(
      `SELECT d.id FROM documents d
       INNER JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND u.company_id = ? AND d.deleted_at IS NULL`,
      [docId, companyId]
    );
    if (!rows.length) return res.status(404).type('text').send('Document not found for this company.');
    const reasonForDb = status === 'REJECTED' ? rejectionReason : null;
    await pool.query(
      'UPDATE documents SET approval_status = ?, approval_rejection_reason = ? WHERE id = ?',
      [status, reasonForDb, docId]
    );
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_APPROVAL_SET',
      details: `doc_id=${docId} company_id=${companyId} status=${status}`,
      req,
    });
    const msg =
      status === 'APPROVED'
        ? 'Document approved.'
        : status === 'REJECTED'
          ? 'Document rejected.'
          : 'Document status updated.';
    return redirectAfterDocumentApproval(req, res, companyId, msg);
  } catch (err) {
    console.error(err);
    return redirectAfterDocumentApproval(req, res, companyId, 'Could not update document status.');
  }
});

router.get('/companies/:id/admins/new', (req, res) => sendSpaOr503(res));

router.post('/companies/:id/admins', async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();
  if (!companyId) return res.redirect(ADMIN_ORG_LIST);
  if (!emailTrim || !fullName || !tempPassword || tempPassword.length < 6) {
    return res.redirect(`/admin/companies/${companyId}/admins/new?message=Fill all fields; password at least 6 characters`);
  }
  try {
    const [cc] = await pool.query('SELECT id FROM companies WHERE id = ?', [companyId]);
    if (!cc.length)
      return res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Company not found')}`);
    const [[co]] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, password_must_change, profile_completed, company)
       VALUES (?, ?, ?, 'CLIENT_ADMIN', ?, 1, 0, ?)`,
      [emailTrim, hash, fullName, companyId, co.name]
    );
    await log({
      userId: req.session.userId,
      action: 'SYSTEM_CREATE_CLIENT_ADMIN',
      details: `email=${emailTrim} company_id=${companyId}`,
      req,
    });
    res.redirect(`${ADMIN_ORG_LIST}?message=${encodeURIComponent('Manager created')}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect(`/admin/companies/${companyId}/admins/new?message=Email already in use`);
    }
    console.error(err);
    res.redirect(`/admin/companies/${companyId}/admins/new?message=Could not create user`);
  }
});

module.exports = router;
