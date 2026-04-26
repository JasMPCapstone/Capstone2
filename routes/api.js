const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { pool } = require('../config/database');
const { uploadDir } = require('../middleware/upload');
const { requireApiSession } = require('../middleware/authApi');
const { enforceOnboardingApi } = require('../middleware/onboarding');
const { queryDocumentList } = require('../lib/services/documentsList');
const { apiGeneral: apiLimiter, authForgot: forgotLimiter } = require('../middleware/rateLimit');
const { requestPasswordResetEmail } = require('../lib/forgot-password-request');
const { canAccessDocument } = require('../lib/documentAccess');
const { isSystemAdmin, isClientAdmin } = require('../lib/roles');
const { getQRDataURL, generateSecret } = require('../lib/twofactor');

const router = express.Router();

const avatarsDir = path.join(uploadDir, 'avatars');
/** Default 8MB; override with AVATAR_MAX_BYTES (bytes). */
const AVATAR_MAX_BYTES = parseInt(process.env.AVATAR_MAX_BYTES || String(8 * 1024 * 1024), 10);
function avatarMaxSizeLabel() {
  const mb = AVATAR_MAX_BYTES / (1024 * 1024);
  return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`;
}

function avatarMimeForFilename(safe) {
  const lower = safe.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Stream avatar file for a user id, or 404. Caller must authorize. */
async function sendAvatarFileForUserId(res, userId, cacheMaxAgeSec = 120) {
  const [rows] = await pool.query('SELECT avatar_filename FROM users WHERE id = ?', [userId]);
  const fn = rows[0] && rows[0].avatar_filename;
  if (!fn) return res.status(404).end();
  const safe = path.basename(String(fn));
  const filePath = path.join(avatarsDir, safe);
  if (!filePath.startsWith(avatarsDir) || !fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.setHeader('Content-Type', avatarMimeForFilename(safe));
  res.setHeader('Cache-Control', `private, max-age=${cacheMaxAgeSec}`);
  return res.sendFile(filePath);
}

async function canViewerAccessUserAvatar(req, targetUserId) {
  if (!targetUserId || !req.session.userId) return false;
  if (Number(req.session.userId) === Number(targetUserId)) return true;
  if (isSystemAdmin(req.session.role)) return true;
  if (isClientAdmin(req.session.role) && req.session.companyId) {
    const [rows] = await pool.query('SELECT company_id FROM users WHERE id = ?', [targetUserId]);
    const cid = rows[0] && rows[0].company_id;
    return cid != null && Number(cid) === Number(req.session.companyId);
  }
  return false;
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(avatarsDir, { recursive: true });
      cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase();
      const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `u${req.session.userId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safe}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('IMAGE_TYPE'), ok);
  },
});

if (process.env.CORS_ORIGIN) {
  router.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );
}

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'medsupply-portal' });
});

/**
 * Password reset request (JSON). Same behavior as POST /forgot-password: email sent when account exists;
 * response is generic for privacy.
 */
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const result = await requestPasswordResetEmail(req, req.body && req.body.email);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json({
    ok: true,
    message:
      "If that email is registered and active, we've sent a link to reset your password. Check your inbox and spam folder.",
  });
});

/** Session snapshot for SPA (onboarding flags; not blocked by enforceOnboardingApi). */
router.get('/me', requireApiSession, (req, res) => {
  res.json({
    userId: req.session.userId,
    email: req.session.email,
    fullName: req.session.fullName,
    preferredName: req.session.preferredName || null,
    role: req.session.role,
    companyId: req.session.companyId,
    passwordMustChange: !!req.session.passwordMustChange,
    profileCompleted: !!req.session.profileCompleted,
    twoFactorEnabled: !!req.session.twoFactorEnabled,
  });
});

router.get('/settings/2fa', requireApiSession, enforceOnboardingApi, async (req, res) => {
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
    res.json({
      twoFactorEnabled: !!enabled,
      qrDataURL,
      manualSecret,
      require2FA: req.query.style === 'required',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load two-factor settings.' });
  }
});

/** Start or resume 2FA setup (session temp secret + QR). Idempotent if temp already exists. */
router.post('/settings/2fa/start', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT two_factor_enabled FROM users WHERE id = ?', [req.session.userId]);
    const userEnabled = userRows[0] && userRows[0].two_factor_enabled;
    const require2FA = req.query.style === 'required';

    if (userEnabled) {
      return res.json({
        twoFactorEnabled: true,
        qrDataURL: null,
        manualSecret: null,
        require2FA,
      });
    }

    if (!req.session.temp2FASecret) {
      const { secret, otpauth } = generateSecret(req.session.email || 'user');
      req.session.temp2FASecret = { secret, otpauth };
    }
    const tempSecret = req.session.temp2FASecret;
    const qrDataURL = await getQRDataURL(tempSecret.otpauth);
    res.json({
      twoFactorEnabled: false,
      qrDataURL,
      manualSecret: tempSecret.secret,
      require2FA,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start two-factor setup.' });
  }
});

/** Clear in-progress 2FA setup (same as POST /settings/2fa/cancel HTML). */
router.post('/settings/2fa/cancel', requireApiSession, enforceOnboardingApi, apiLimiter, (req, res) => {
  delete req.session.temp2FASecret;
  res.json({ ok: true });
});

router.get('/documents', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  try {
    const list = await queryDocumentList(
      pool,
      {
        userId: req.session.userId,
        role: req.session.role,
        companyId: req.session.companyId,
      },
      req.query
    );
    res.json({
      documents: list.rows,
      total: list.total,
      page: list.page,
      pageSize: list.pageSize,
      totalPages: list.totalPages,
      activeTab: list.activeTab,
      hasApprovalStatus: list.hasApprovalStatus,
      hasDocumentType: list.hasDocumentType,
      companiesForFilter: list.companiesForFilter,
      tagOptions: list.tagOptions,
      documentTypes: list.documentTypes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});

/**
 * Recent uploads + unread count. Read state: users.notifications_last_read_at + notification_document_reads.
 */
router.get('/notifications', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  try {
    const [[userRow]] = await pool.query(
      'SELECT notifications_last_read_at FROM users WHERE id = ?',
      [req.session.userId]
    );
    const lastReadRaw = userRow && userRow.notifications_last_read_at;
    const lastRead = lastReadRaw ? new Date(lastReadRaw) : null;
    const lastReadValid = !!(lastRead && !Number.isNaN(lastRead.getTime()));
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [readRows] = await pool.query(
      'SELECT document_id FROM notification_document_reads WHERE user_id = ?',
      [req.session.userId]
    );
    const readDocIds = new Set((readRows || []).map((r) => Number(r.document_id)));

    let base =
      `FROM documents d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN companies comp ON comp.id = u.company_id
       WHERE d.deleted_at IS NULL`;
    const params = [];
    if (isSystemAdmin(req.session.role)) {
      // all orgs
    } else if (isClientAdmin(req.session.role) && req.session.companyId) {
      base += ' AND u.company_id = ?';
      params.push(req.session.companyId);
    } else {
      base += ' AND d.user_id = ?';
      params.push(req.session.userId);
    }

    const [rows] = await pool.query(
      `SELECT d.id, d.title, d.original_filename, d.created_at, u.full_name AS owner_name, comp.name AS company_name
       ${base}
       ORDER BY d.created_at DESC
       LIMIT 15`,
      params
    );

    const countParams = [...params, req.session.userId];
    let countSql = `SELECT COUNT(*) AS c ${base}
       AND d.id NOT IN (SELECT document_id FROM notification_document_reads WHERE user_id = ?)
       AND (`;
    if (lastReadValid) {
      countSql += 'd.created_at > ?)';
      countParams.push(lastRead);
    } else {
      countSql += 'd.created_at >= ?)';
      countParams.push(fourteenDaysAgo);
    }

    const [[countRow]] = await pool.query(countSql, countParams);
    const unreadCount = Math.min(Number(countRow.c) || 0, 99);

    function docIsUnread(docId, createdAtRaw) {
      if (readDocIds.has(Number(docId))) return false;
      const created = new Date(createdAtRaw);
      if (Number.isNaN(created.getTime())) return false;
      if (lastReadValid) {
        return created > lastRead;
      }
      return created >= fourteenDaysAgo;
    }

    const items = rows.map((r) => ({
      id: r.id,
      title: (r.title || r.original_filename || 'Untitled').toString(),
      companyName: r.company_name || null,
      ownerName: r.owner_name || null,
      createdAt: r.created_at,
      isNew: docIsUnread(r.id, r.created_at),
    }));

    res.json({ items, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.post('/notifications/mark-read', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  try {
    await pool.query('UPDATE users SET notifications_last_read_at = UTC_TIMESTAMP() WHERE id = ?', [
      req.session.userId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.post('/notifications/mark-document-read', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  const documentId = parseInt(req.body && req.body.documentId, 10);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return res.status(400).json({ error: 'Invalid document id' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id
       FROM documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [documentId]
    );
    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query(
      `INSERT INTO notification_document_reads (user_id, document_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
      [req.session.userId, documentId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save read state.' });
  }
});

/** Profile photo (binary) for signed-in user; not gated by onboarding. */
router.get('/profile/avatar', requireApiSession, apiLimiter, async (req, res) => {
  try {
    return await sendAvatarFileForUserId(res, req.session.userId, 300);
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
});

/**
 * Profile photo for a specific user (system admin: any; client admin: same company; user: self).
 * Not gated by onboarding so headers/lists can load during setup.
 */
router.get('/users/:id/avatar', requireApiSession, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).end();
  try {
    const allowed = await canViewerAccessUserAvatar(req, id);
    if (!allowed) return res.status(403).end();
    return await sendAvatarFileForUserId(res, id);
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
});

router.post(
  '/profile/avatar',
  requireApiSession,
  enforceOnboardingApi,
  apiLimiter,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `Image is too large. Maximum size is ${avatarMaxSizeLabel()}.` });
      }
      return res.status(400).json({
        error: `Use a JPEG, PNG, or WebP image (maximum ${avatarMaxSizeLabel()}).`,
      });
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    try {
      const [rows] = await pool.query('SELECT avatar_filename FROM users WHERE id = ?', [req.session.userId]);
      const old = rows[0] && rows[0].avatar_filename;
      if (old) {
        const oldPath = path.join(avatarsDir, path.basename(String(old)));
        if (oldPath.startsWith(avatarsDir) && fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      await pool.query('UPDATE users SET avatar_filename = ? WHERE id = ?', [req.file.filename, req.session.userId]);
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      try {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(500).json({ error: 'Could not save profile photo.' });
    }
  }
);

router.delete('/profile/avatar', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT avatar_filename FROM users WHERE id = ?', [req.session.userId]);
    const fn = rows[0] && rows[0].avatar_filename;
    if (fn) {
      const filePath = path.join(avatarsDir, path.basename(String(fn)));
      if (filePath.startsWith(avatarsDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await pool.query('UPDATE users SET avatar_filename = NULL WHERE id = ?', [req.session.userId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not remove profile photo.' });
  }
});

/**
 * Profile snapshot for header menu (address + org from DB).
 * Intentionally not gated by enforceOnboardingApi so the account menu can load during onboarding.
 */
router.get('/profile', requireApiSession, apiLimiter, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.full_name, u.email, u.preferred_name, u.phone, u.state, u.city, u.suburb, u.company,
              u.emergency_contact_name, u.emergency_contact_phone, u.avatar_filename,
              c.name AS organization_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = ?`,
      [req.session.userId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    const [[docRow]] = await pool.query(
      `SELECT COUNT(*) AS c,
              COALESCE(SUM(CASE WHEN UPPER(TRIM(IFNULL(approval_status, ''))) = 'APPROVED' THEN 1 ELSE 0 END), 0) AS approved_count,
              COALESCE(SUM(CASE WHEN UPPER(TRIM(IFNULL(approval_status, ''))) = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_count
       FROM documents WHERE user_id = ? AND deleted_at IS NULL`,
      [req.session.userId]
    );
    const documentsUploaded = Number(docRow && docRow.c) || 0;
    const approved = Number(docRow && docRow.approved_count) || 0;
    const rejected = Number(docRow && docRow.rejected_count) || 0;
    const decided = approved + rejected;
    const approvalStars = decided > 0 ? Math.round((5 * approved) / decided) : 0;
    const parts = [row.suburb, row.city, row.state].filter((p) => p && String(p).trim());
    const addressLine = parts.length ? parts.join(', ') : null;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      fullName: row.full_name,
      preferredName: row.preferred_name,
      phone: row.phone,
      email: row.email,
      addressLine,
      suburb: row.suburb,
      city: row.city,
      state: row.state,
      companyLabel: row.company,
      organizationName: row.organization_name,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      role: req.session.role,
      documentsUploaded,
      approvalStars,
      hasAvatar: !!(row.avatar_filename && String(row.avatar_filename).trim()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.get('/documents/:id/history', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid document id' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const docActions = [
      'DOCUMENT_UPLOAD',
      'DOCUMENT_EDIT',
      'DOCUMENT_DELETE',
      'DOCUMENT_DOWNLOAD',
      'DOCUMENT_APPROVAL_SET',
    ];
    const inList = docActions.map(() => '?').join(',');
    const [events] = await pool.query(
      `SELECT a.action, a.details, a.created_at,
              u.full_name AS actor_name, u.email AS actor_email, u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action IN (${inList})
         AND (
           a.details LIKE CONCAT('id=', ?, ' %')
           OR a.details LIKE CONCAT('doc_id=', ?, ' %')
         )
       ORDER BY a.created_at DESC
       LIMIT 80`,
      [...docActions, id, id]
    );

    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load document history.' });
  }
});

router.get('/documents/:id', requireApiSession, enforceOnboardingApi, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Invalid document id' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.full_name AS owner_name, u.email AS owner_email, u.company_id AS owner_company_id,
              comp.name AS company_name
       FROM documents d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN companies comp ON comp.id = u.company_id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({
      document: doc,
      isAdmin: isSystemAdmin(req.session.role) || isClientAdmin(req.session.role),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load document.' });
  }
});

module.exports = router;
