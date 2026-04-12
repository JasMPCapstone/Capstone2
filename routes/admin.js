const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const uploadDir = path.join(process.cwd(), 'uploads');
const { log } = require('../lib/audit');
const { requireAuth, requireSystemAdmin } = require('../middleware/auth');
const { normalizeApprovalStatus } = require('../lib/migrate-document-approval');

const router = express.Router();
router.use(requireAuth);
router.use(requireSystemAdmin);

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
  const back = (req.get('Referrer') || '/admin').toString();
  const safe = back.startsWith('/') ? back : '/admin';
  res.redirect(safe);
});

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [companyCount] = await pool.query('SELECT COUNT(*) AS c FROM companies');

    let pendingApprovalCount = 0;
    try {
      const [pendingRows] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL AND approval_status = 'PENDING'`
      );
      pendingApprovalCount = pendingRows[0].c;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    }

    let docUploadsThisMonth = 0;
    let docUploadsLastMonth = 0;
    let docUploadDeltaText = '';
    let docUploadDeltaClass = 'is-neutral';
    try {
      const [[thisM]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents
         WHERE deleted_at IS NULL
         AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         AND created_at < DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`
      );
      const [[lastM]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents
         WHERE deleted_at IS NULL
         AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
         AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')`
      );
      docUploadsThisMonth = thisM.c;
      docUploadsLastMonth = lastM.c;
      if (docUploadsLastMonth > 0) {
        const pct = Math.round(((docUploadsThisMonth - docUploadsLastMonth) / docUploadsLastMonth) * 100);
        docUploadDeltaText = (pct >= 0 ? '+' : '') + pct + '% vs last month';
        docUploadDeltaClass = pct > 0 ? 'is-positive' : pct < 0 ? 'is-negative' : 'is-neutral';
      } else if (docUploadsThisMonth > 0) {
        docUploadDeltaText = 'Uploads started this month';
        docUploadDeltaClass = 'is-positive';
      } else {
        docUploadDeltaText = 'No uploads in the last two months';
        docUploadDeltaClass = 'is-neutral';
      }
    } catch (e) {
      docUploadDeltaText = '';
    }

    res.render('admin/dashboard', {
      userCount: userCount[0].c,
      companyCount: companyCount[0].c,
      pendingApprovalCount,
      docUploadsThisMonth,
      docUploadDeltaText,
      docUploadDeltaClass,
      message: req.query.message || '',
      navActive: 'admin',
      adminNav: 'overview',
      adminPageTitle: 'Dashboard',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load dashboard.' });
  }
});

// Roles overview (directory tab)
router.get('/roles', (req, res) => {
  res.render('admin/roles', {
    adminNav: 'directory',
    adminDirectoryTab: 'roles',
    adminPageTitle: 'Roles',
  });
});

// Add user (must be before /users/:id routes)
router.get('/users/new', async (req, res) => {
  try {
    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
    let preselectCompanyId = null;
    const q = req.query.companyId;
    if (q !== undefined && q !== '') {
      const n = parseInt(q, 10);
      if (!Number.isNaN(n) && n > 0) preselectCompanyId = n;
    }
    res.render('admin/user-new', {
      companies,
      preselectCompanyId,
      message: req.query.message || '',
      adminNav: 'directory',
      adminDirectoryTab: 'users',
      adminPageTitle: 'Add user',
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Could not load form');
  }
});

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
    return res.redirect(`/admin/users${qs ? `?${qs}` : ''}`);
  };

  if (!companyId || Number.isNaN(companyId)) {
    return redirectForm('Choose a company');
  }
  if (!emailTrim || !fullName || !tempPassword || tempPassword.length < 6) {
    return redirectForm('Fill all fields; password at least 6 characters');
  }
  const role = roleRaw === 'CLIENT_ADMIN' ? 'CLIENT_ADMIN' : 'CLIENT';
  if (role !== 'CLIENT_ADMIN' && role !== 'CLIENT') {
    return redirectForm('Invalid role');
  }
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
    const msg = role === 'CLIENT_ADMIN' ? 'Client administrator created' : 'User created';
    return redirectList(msg, { companyId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return redirectForm('Email already in use');
    }
    console.error(err);
    return redirectForm('Could not create user');
  }
});

// List users
router.get('/users', async (req, res) => {
  try {
    let selectedCompanyId = null;
    const q = req.query.companyId;
    if (q !== undefined && q !== '') {
      const n = parseInt(q, 10);
      if (!Number.isNaN(n) && n > 0) selectedCompanyId = n;
    }

    const pageSize = 10;
    let page = parseInt(req.query.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');

    const whereClause = selectedCompanyId !== null ? ' WHERE u.company_id = ?' : '';
    const whereParams = selectedCompanyId !== null ? [selectedCompanyId] : [];

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS c FROM users u${whereClause}`, whereParams);
    const usersTotalCount = countRow.c;
    const totalPages = Math.max(1, Math.ceil(usersTotalCount / pageSize));
    if (page > totalPages) page = totalPages;
    const offset = (page - 1) * pageSize;

    const listSql = `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.company_id, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(listSql, [...whereParams, pageSize, offset]);

    const usersListQs = (p) => {
      const sp = new URLSearchParams();
      if (selectedCompanyId !== null) sp.set('companyId', String(selectedCompanyId));
      if (p > 1) sp.set('page', String(p));
      const s = sp.toString();
      return s ? `?${s}` : '';
    };

    res.render('admin/users', {
      users: rows,
      companies,
      selectedCompanyId,
      usersTotalCount,
      usersPage: page,
      usersTotalPages: totalPages,
      usersPageSize: pageSize,
      usersListPrev: page > 1 ? `/admin/users${usersListQs(page - 1)}` : null,
      usersListNext: page < totalPages ? `/admin/users${usersListQs(page + 1)}` : null,
      message: req.query.message || '',
      adminNav: 'directory',
      adminDirectoryTab: 'users',
      adminPageTitle: 'User management',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load users.' });
  }
});

// Deactivate user
router.post('/users/:id/deactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  if (id === req.session.userId) {
    return res.redirect('/admin/users?message=Cannot deactivate yourself');
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect('/admin/users');
    if (user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN') {
      const [[{ c }]] = await pool.query(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('SYSTEM_ADMIN','ADMIN') AND is_active = 1 AND id != ?",
        [id]
      );
      if (c < 1) {
        return res.redirect('/admin/users?message=Cannot deactivate the last system administrator');
      }
    }
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_DEACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect('/admin/users?message=User deactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Action failed');
  }
});

// Reactivate user
router.post('/users/:id/reactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  try {
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.redirect('/admin/users');
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_REACTIVATE',
      details: `user_id=${id} email=${user.email}`,
      req,
    });
    res.redirect('/admin/users?message=User reactivated');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Action failed');
  }
});

// Permanently delete user (documents removed from disk; DB rows cascade)
router.post('/users/:id/delete', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  if (id === req.session.userId) {
    return res.redirect('/admin/users?message=You cannot delete your own account');
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const target = rows[0];
    if (!target) return res.redirect('/admin/users?message=User not found');
    if (target.role === 'SYSTEM_ADMIN' || target.role === 'ADMIN') {
      const [[{ c }]] = await pool.query(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('SYSTEM_ADMIN','ADMIN') AND id != ?",
        [id]
      );
      if (c < 1) {
        return res.redirect('/admin/users?message=Cannot delete the last system administrator');
      }
    }
    const [docRows] = await pool.query('SELECT filename FROM documents WHERE user_id = ?', [id]);
    for (const d of docRows) {
      const fp = path.join(uploadDir, d.filename);
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp);
        } catch (e) {
          console.error(e);
        }
      }
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'ADMIN_USER_DELETE',
      details: `user_id=${id} email=${target.email}`,
      req,
    });
    res.redirect('/admin/users?message=User permanently deleted');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Could not delete user');
  }
});

// Reset password form
router.get('/users/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  try {
    const [rows] = await pool.query('SELECT id, email, full_name FROM users WHERE id = ?', [id]);
    const targetUser = rows[0];
    if (!targetUser) return res.status(404).render('error', { message: 'User not found.' });
    const message = req.query.message || '';
    res.render('admin/reset-password', {
      targetUser,
      message,
      adminNav: 'directory',
      adminDirectoryTab: 'users',
      adminPageTitle: 'Reset password',
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

// Reset password submit
router.post('/users/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const newPassword = (req.body.newPassword || '').toString();
  if (!id) return res.redirect('/admin/users');
  if (newPassword.length < 6) {
    return res.redirect(`/admin/users/${id}/reset-password?message=Password must be at least 6 characters`);
  }
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users WHERE id = ?', [id]);
    const targetUser = rows[0];
    if (!targetUser) return res.redirect('/admin/users');
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
    res.redirect('/admin/users?message=Password reset successfully');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users?message=Reset failed');
  }
});

// Audit logs with filters
router.get('/audit', async (req, res) => {
  try {
    const action = (req.query.action || '').trim();
    const userId = (req.query.userId || '').trim();
    const dateFrom = (req.query.dateFrom || '').trim();
    const dateTo = (req.query.dateTo || '').trim();

    let sql = `
      SELECT a.id, a.user_id, a.action, a.details, a.ip_address, a.created_at, u.email, u.full_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }
    if (userId) {
      sql += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (dateFrom) {
      sql += ' AND a.created_at >= ?';
      params.push(dateFrom + ' 00:00:00');
    }
    if (dateTo) {
      sql += ' AND a.created_at <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.render('admin/audit', {
      logs: rows,
      query: req.query,
      adminNav: 'audit',
      adminPageTitle: 'Audit log',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load audit logs.' });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const [companies] = await pool.query(
      `SELECT c.id, c.name, c.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS user_count,
        (SELECT COUNT(*) FROM documents d
           INNER JOIN users u ON u.id = d.user_id
           WHERE u.company_id = c.id AND d.deleted_at IS NULL) AS doc_count,
        (SELECT COUNT(*) FROM documents d
           INNER JOIN users u ON u.id = d.user_id
           WHERE u.company_id = c.id AND d.deleted_at IS NULL AND d.approval_status = 'PENDING') AS pending_doc_count
       FROM companies c ORDER BY c.name ASC`
    );
    res.render('admin/companies', {
      companies,
      message: req.query.message || '',
      adminNav: 'directory',
      adminDirectoryTab: 'companies',
      adminPageTitle: 'Company management',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load companies.' });
  }
});

router.post('/companies', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();

  const redirectForm = (msg) =>
    res.redirect('/admin/companies/new?message=' + encodeURIComponent(msg));

  if (!name) return redirectForm('Company name is required');
  if (!fullName || !emailTrim || !tempPassword || tempPassword.length < 6) {
    return redirectForm('Enter the client administrator’s full name, email, and a temporary password (at least 6 characters).');
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
      `/admin/companies/${companyId}?message=${encodeURIComponent('Company and client administrator created.')}`
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
    return redirectForm('Could not create company and administrator');
  } finally {
    if (conn) conn.release();
  }
});

router.get('/companies/new', (req, res) => {
  res.render('admin/company-new', {
    message: req.query.message || '',
    adminNav: 'directory',
    adminDirectoryTab: 'companies',
    adminPageTitle: 'Add company',
  });
});

router.get('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/companies');
  try {
    const [companies] = await pool.query('SELECT id, name, created_at FROM companies WHERE id = ?', [id]);
    if (!companies[0]) return res.status(404).render('error', { message: 'Company not found.' });
    const company = companies[0];
    const [users] = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users WHERE company_id = ? ORDER BY FIELD(role, 'CLIENT_ADMIN', 'CLIENT', 'SYSTEM_ADMIN', 'ADMIN'), email ASC`,
      [id]
    );
    const [documents] = await pool.query(
      `SELECT d.id, d.title, d.original_filename, d.file_type, d.file_extension, d.file_size,
              d.created_at, d.updated_at, d.approval_status,
              u.full_name AS owner_name, u.email AS owner_email, u.role AS owner_role
       FROM documents d
       JOIN users u ON u.id = d.user_id
       WHERE u.company_id = ? AND d.deleted_at IS NULL
       ORDER BY d.updated_at DESC`,
      [id]
    );
    res.render('admin/company-detail', {
      company,
      users,
      documents,
      message: req.query.message || '',
      adminNav: 'directory',
      adminDirectoryTab: 'companies',
      adminPageTitle: company.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load company.' });
  }
});

router.post('/companies/:id/delete', async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!companyId) {
    return res.redirect('/admin/companies?message=' + encodeURIComponent('Invalid company.'));
  }

  let conn;
  try {
    const [[company]] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [companyId]);
    if (!company) {
      return res.redirect('/admin/companies?message=' + encodeURIComponent('Company not found.'));
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
      const fp = path.join(uploadDir, row.filename);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
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
      '/admin/companies?message=' +
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
    res.redirect('/admin/companies?message=' + encodeURIComponent('Could not delete company.'));
  } finally {
    if (conn) conn.release();
  }
});

router.post('/companies/:companyId/documents/:docId/approval', async (req, res) => {
  const companyId = parseInt(req.params.companyId, 10);
  const docId = parseInt(req.params.docId, 10);
  const status = normalizeApprovalStatus(req.body.approval_status);
  if (!companyId || !docId) return res.redirect('/admin/companies');
  try {
    const [rows] = await pool.query(
      `SELECT d.id FROM documents d
       INNER JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND u.company_id = ? AND d.deleted_at IS NULL`,
      [docId, companyId]
    );
    if (!rows.length) return res.status(404).render('error', { message: 'Document not found for this company.' });
    await pool.query('UPDATE documents SET approval_status = ? WHERE id = ?', [status, docId]);
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_APPROVAL_SET',
      details: `doc_id=${docId} company_id=${companyId} status=${status}`,
      req,
    });
    const backToDash = (req.body.redirect || '').toString().trim() === '/admin';
    const msg =
      status === 'APPROVED'
        ? 'Document approved.'
        : status === 'REJECTED'
          ? 'Document rejected.'
          : 'Document status updated.';
    if (backToDash) {
      return res.redirect(`/admin?message=${encodeURIComponent(msg)}`);
    }
    res.redirect(`/admin/companies/${companyId}?message=${encodeURIComponent(msg)}`);
  } catch (err) {
    console.error(err);
    const backToDash = (req.body.redirect || '').toString().trim() === '/admin';
    if (backToDash) {
      return res.redirect('/admin?message=' + encodeURIComponent('Could not update document status.'));
    }
    res.redirect(`/admin/companies/${companyId}?message=${encodeURIComponent('Could not update status.')}`);
  }
});

router.get('/companies/:id/admins/new', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/companies');
  try {
    const [rows] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).render('error', { message: 'Company not found.' });
    res.render('admin/company-admin-form', {
      company: rows[0],
      message: req.query.message || '',
      adminNav: 'directory',
      adminDirectoryTab: 'companies',
      adminPageTitle: `Client admin · ${rows[0].name}`,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/companies');
  }
});

router.post('/companies/:id/admins', async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  const emailTrim = (req.body.email || '').toString().trim().toLowerCase();
  const fullName = (req.body.fullName || '').toString().trim();
  const tempPassword = (req.body.tempPassword || '').toString();
  if (!companyId) return res.redirect('/admin/companies');
  if (!emailTrim || !fullName || !tempPassword || tempPassword.length < 6) {
    return res.redirect(`/admin/companies/${companyId}/admins/new?message=Fill all fields; password at least 6 characters`);
  }
  try {
    const [cc] = await pool.query('SELECT id FROM companies WHERE id = ?', [companyId]);
    if (!cc.length) return res.redirect('/admin/companies?message=Company not found');
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
    res.redirect('/admin/companies?message=Client administrator created');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect(`/admin/companies/${companyId}/admins/new?message=Email already in use`);
    }
    console.error(err);
    res.redirect(`/admin/companies/${companyId}/admins/new?message=Could not create user`);
  }
});

module.exports = router;
