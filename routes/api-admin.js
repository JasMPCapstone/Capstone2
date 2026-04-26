const express = require('express');
const { pool } = require('../config/database');
const { requireApiSession, requireApiSystemAdmin } = require('../middleware/authApi');
const { AUDIT_EVENT_OPTIONS } = require('../lib/auditEventsMeta');

const router = express.Router();
router.use(requireApiSession, requireApiSystemAdmin);

router.get('/dashboard', async (req, res) => {
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

    let docUploadsLast30Days = 0;
    let docUploadsPrev30Days = 0;
    let docUploadDeltaText = '';
    let docUploadDeltaClass = 'is-neutral';
    try {
      const [[last30]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents
         WHERE deleted_at IS NULL
         AND DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 29 DAY) AND CURDATE()`
      );
      const [[prev30]] = await pool.query(
        `SELECT COUNT(*) AS c FROM documents
         WHERE deleted_at IS NULL
         AND DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 59 DAY) AND DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
      );
      docUploadsLast30Days = Number(last30.c) || 0;
      docUploadsPrev30Days = Number(prev30.c) || 0;
      if (docUploadsPrev30Days > 0) {
        const pct = Math.round(
          ((docUploadsLast30Days - docUploadsPrev30Days) / docUploadsPrev30Days) * 100
        );
        if (pct > 0) {
          docUploadDeltaText = `${pct}% more than the previous 30 days`;
          docUploadDeltaClass = 'is-positive';
        } else if (pct < 0) {
          docUploadDeltaText = `${Math.abs(pct)}% fewer than the previous 30 days`;
          docUploadDeltaClass = 'is-negative';
        } else {
          docUploadDeltaText = 'Same as the previous 30 days';
          docUploadDeltaClass = 'is-neutral';
        }
      } else if (docUploadsLast30Days > 0) {
        docUploadDeltaText = '100% more than the previous 30 days';
        docUploadDeltaClass = 'is-positive';
      } else {
        docUploadDeltaText = 'No uploads in the last 60 days';
        docUploadDeltaClass = 'is-neutral';
      }
    } catch (e) {
      docUploadDeltaText = '';
    }

    res.json({
      userCount: userCount[0].c,
      companyCount: companyCount[0].c,
      pendingApprovalCount,
      docUploadsLast30Days,
      docUploadsPrev30Days,
      docUploadDeltaText,
      docUploadDeltaClass,
      message: req.query.message || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

router.get('/companies-list', async (req, res) => {
  try {
    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
    res.json({ companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load companies.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    let selectedCompanyId = null;
    const q = req.query.companyId;
    if (q !== undefined && q !== '') {
      const n = parseInt(q, 10);
      if (!Number.isNaN(n) && n > 0) selectedCompanyId = n;
    }

    const nameSearch = (req.query.name || '').toString().trim();

    const pageSize = 10;
    let page = parseInt(req.query.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');

    const whereParts = [];
    const whereParams = [];
    if (selectedCompanyId !== null) {
      whereParts.push('u.company_id = ?');
      whereParams.push(selectedCompanyId);
    }
    if (nameSearch) {
      whereParts.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      const like = `%${nameSearch}%`;
      whereParams.push(like, like);
    }
    const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS c FROM users u${whereClause}`, whereParams);
    const usersTotalCount = countRow.c;
    const totalPages = Math.max(1, Math.ceil(usersTotalCount / pageSize));
    if (page > totalPages) page = totalPages;
    const offset = (page - 1) * pageSize;

    const listSql = `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.company_id, u.avatar_filename, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(listSql, [...whereParams, pageSize, offset]);

    const users = rows.map((r) => {
      const { avatar_filename: af, ...rest } = r;
      return { ...rest, hasAvatar: !!(af && String(af).trim()) };
    });

    res.json({
      users,
      companies,
      selectedCompanyId,
      nameSearch: nameSearch || null,
      usersTotalCount,
      usersPage: page,
      usersTotalPages: totalPages,
      usersPageSize: pageSize,
      message: req.query.message || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

/** Card directory: users grouped by organization, with document approval stats (for system admin UI). */
router.get('/users/grouped', async (req, res) => {
  try {
    let selectedCompanyId = null;
    const q = req.query.companyId;
    if (q !== undefined && q !== '') {
      const n = parseInt(q, 10);
      if (!Number.isNaN(n) && n > 0) selectedCompanyId = n;
    }
    const unassignedOnly = req.query.unassigned === '1';

    const nameSearch = (req.query.name || '').toString().trim();

    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');

    const whereParts = [];
    const whereParams = [];
    if (unassignedOnly) {
      whereParts.push('u.company_id IS NULL');
    } else if (selectedCompanyId !== null) {
      whereParts.push('u.company_id = ?');
      whereParams.push(selectedCompanyId);
    }
    if (nameSearch) {
      whereParts.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      const like = `%${nameSearch}%`;
      whereParams.push(like, like);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const listSql = `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.company_id, u.avatar_filename, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       ${whereClause}
       ORDER BY u.created_at DESC`;
    const [rows] = await pool.query(listSql, whereParams);

    const ids = rows.map((r) => r.id);
    const statByUser = {};
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const [docStats] = await pool.query(
        `SELECT d.user_id AS user_id,
                COUNT(d.id) AS documents_uploaded,
                SUM(CASE WHEN UPPER(TRIM(IFNULL(d.approval_status, ''))) = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN UPPER(TRIM(IFNULL(d.approval_status, ''))) = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count
         FROM documents d
         WHERE d.user_id IN (${placeholders}) AND d.deleted_at IS NULL
         GROUP BY d.user_id`,
        ids
      );
      for (const row of docStats) {
        const uid = row.user_id;
        const uploaded = Number(row.documents_uploaded) || 0;
        const approved = Number(row.approved_count) || 0;
        const rejected = Number(row.rejected_count) || 0;
        const decided = approved + rejected;
        const approvalStars = decided > 0 ? Math.round((5 * approved) / decided) : 0;
        statByUser[uid] = { documentsUploaded: uploaded, approvalStars };
      }
    }

    const users = rows.map((r) => {
      const { avatar_filename: af, ...rest } = r;
      const s = statByUser[r.id] || { documentsUploaded: 0, approvalStars: 0 };
      return {
        ...rest,
        hasAvatar: !!(af && String(af).trim()),
        documentsUploaded: s.documentsUploaded,
        approvalStars: s.approvalStars,
      };
    });

    function sortDirectoryUsers(list) {
      return [...list].sort((a, b) => {
        const rank = (role) => (role === 'CLIENT_ADMIN' ? 2 : role === 'CLIENT' ? 1 : 0);
        const dr = rank(b.role) - rank(a.role);
        if (dr !== 0) return dr;
        const starDiff = (Number(b.approvalStars) || 0) - (Number(a.approvalStars) || 0);
        if (starDiff !== 0) return starDiff;
        const docDiff = (Number(b.documentsUploaded) || 0) - (Number(a.documentsUploaded) || 0);
        if (docDiff !== 0) return docDiff;
        return (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' });
      });
    }

    const groupMap = new Map();
    for (const u of users) {
      const key = u.company_id != null ? String(u.company_id) : '_none';
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          companyId: u.company_id,
          companyName:
            u.company_id != null && u.company_name && String(u.company_name).trim()
              ? u.company_name
              : u.company_id != null
                ? 'Organization'
                : 'No organization',
          users: [],
        });
      }
      groupMap.get(key).users.push(u);
    }

    const groups = Array.from(groupMap.values()).map((g) => ({
      companyId: g.companyId,
      companyName: g.companyName,
      users: sortDirectoryUsers(g.users),
      totalCount: g.users.length,
    }));

    groups.sort((a, b) => {
      if (a.companyId == null && b.companyId != null) return 1;
      if (a.companyId != null && b.companyId == null) return -1;
      return a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' });
    });

    res.json({
      groups,
      companies,
      selectedCompanyId: unassignedOnly ? null : selectedCompanyId,
      unassignedOnly,
      nameSearch: nameSearch || null,
      message: req.query.message || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

router.get('/users/:id/for-reset', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [rows] = await pool.query('SELECT id, email, full_name FROM users WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0], message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

/** Full user profile for admin (hero + documents list). */
router.get('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.preferred_name, u.role, u.is_active, u.created_at,
              u.company_id, u.state, u.city, u.suburb, u.company, u.emergency_contact_name, u.emergency_contact_phone,
              u.avatar_filename, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = ?`,
      [id]
    );
    const raw = users[0];
    if (!raw) return res.status(404).json({ error: 'User not found' });
    const { avatar_filename: af, ...userRest } = raw;
    const user = { ...userRest, hasAvatar: !!(af && String(af).trim()) };

    const [[docCountRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM documents WHERE user_id = ? AND deleted_at IS NULL',
      [id]
    );
    const documentsUploaded = Number(docCountRow.c) || 0;

    const [[approvalRow]] = await pool.query(
      `SELECT
          COALESCE(SUM(CASE WHEN UPPER(TRIM(IFNULL(approval_status, ''))) = 'APPROVED' THEN 1 ELSE 0 END), 0) AS approved_count,
          COALESCE(SUM(CASE WHEN UPPER(TRIM(IFNULL(approval_status, ''))) = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_count
       FROM documents WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );
    const approved = Number(approvalRow && approvalRow.approved_count) || 0;
    const rejected = Number(approvalRow && approvalRow.rejected_count) || 0;
    const decided = approved + rejected;
    const approvalStars = decided > 0 ? Math.round((5 * approved) / decided) : 0;

    const [documents] = await pool.query(
      `SELECT d.id, d.title, d.original_filename, d.document_type, d.approval_status, d.created_at
       FROM documents d
       WHERE d.user_id = ? AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC
       LIMIT 200`,
      [id]
    );

    res.json({ user, documentsUploaded, approvalStars, documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

router.get('/audit/meta', async (req, res) => {
  try {
    const [companies] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.company_id
       FROM users u
       ORDER BY (u.full_name IS NULL OR u.full_name = ''), u.full_name ASC, u.email ASC
       LIMIT 2000`
    );
    res.json({ companies, users, events: AUDIT_EVENT_OPTIONS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load activity log options.' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const action = (req.query.action || '').trim();
    const event = (req.query.event || '').trim();
    const userId = (req.query.userId || '').trim();
    const companyIdRaw = (req.query.companyId || '').trim();
    const dateFrom = (req.query.dateFrom || '').trim();
    const dateTo = (req.query.dateTo || '').trim();

    let sql = `
      SELECT a.id, a.user_id, a.action, a.details, a.ip_address, a.created_at,
        u.email, u.full_name, u.company_id, c.name AS company_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE 1=1
    `;
    const params = [];

    if (event) {
      sql += ' AND a.action = ?';
      params.push(event);
    } else if (action) {
      sql += ' AND a.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (userId) {
      const uid = parseInt(userId, 10);
      if (!Number.isNaN(uid) && uid > 0) {
        sql += ' AND a.user_id = ?';
        params.push(uid);
      }
    }
    if (companyIdRaw) {
      const cid = parseInt(companyIdRaw, 10);
      if (!Number.isNaN(cid) && cid > 0) {
        sql += ' AND u.company_id = ?';
        params.push(cid);
      }
    }
    if (dateFrom) {
      sql += ' AND a.created_at >= ?';
      params.push(`${dateFrom} 00:00:00`);
    }
    if (dateTo) {
      sql += ' AND a.created_at <= ?';
      params.push(`${dateTo} 23:59:59`);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json({ logs: rows, query: req.query });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let sql = `SELECT c.id, c.name, c.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS user_count,
        (SELECT COUNT(*) FROM documents d
           INNER JOIN users u ON u.id = d.user_id
           WHERE u.company_id = c.id AND d.deleted_at IS NULL) AS doc_count,
        (SELECT COUNT(*) FROM documents d
           INNER JOIN users u ON u.id = d.user_id
           WHERE u.company_id = c.id AND d.deleted_at IS NULL AND d.approval_status = 'PENDING') AS pending_doc_count
       FROM companies c`;
    const params = [];
    if (q) {
      sql += ' WHERE c.name LIKE ?';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY c.name ASC';

    const [companies] = await pool.query(sql, params);
    res.json({ companies, message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load companies.' });
  }
});

router.get('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [companies] = await pool.query('SELECT id, name, created_at FROM companies WHERE id = ?', [id]);
    if (!companies[0]) return res.status(404).json({ error: 'Company not found' });
    const company = companies[0];
    const [users] = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM users WHERE company_id = ? ORDER BY FIELD(role, 'CLIENT_ADMIN', 'CLIENT', 'SYSTEM_ADMIN', 'ADMIN'), email ASC`,
      [id]
    );
    const [documents] = await pool.query(
      `SELECT d.id, d.title, d.original_filename, d.file_type, d.file_extension, d.file_size,
              d.created_at, d.updated_at, d.approval_status, d.approval_rejection_reason,
              u.full_name AS owner_name, u.email AS owner_email, u.role AS owner_role
       FROM documents d
       JOIN users u ON u.id = d.user_id
       WHERE u.company_id = ? AND d.deleted_at IS NULL
       ORDER BY d.updated_at DESC`,
      [id]
    );
    res.json({ company, users, documents, message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load company.' });
  }
});

router.get('/companies/:id/staff-new', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [rows] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json({ company: rows[0], message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load.' });
  }
});

router.get('/companies/:id/admins-new', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [rows] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json({ company: rows[0], message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load.' });
  }
});

module.exports = router;
