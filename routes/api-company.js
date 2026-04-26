const express = require('express');
const { pool } = require('../config/database');
const { requireApiSession, requireApiClientAdmin } = require('../middleware/authApi');
const { enforceOnboardingApi } = require('../middleware/onboarding');

const router = express.Router();
router.use(requireApiSession, enforceOnboardingApi, requireApiClientAdmin);

/** Documents uploaded by a team member (same company). */
router.get('/team/:id/documents', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  if (!id || !companyId) return res.status(400).json({ error: 'Invalid request' });
  try {
    const [uRows] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ? AND company_id = ?', [
      id,
      companyId,
    ]);
    const u = uRows[0];
    if (!u) return res.status(404).json({ error: 'User not found' });
    const [docs] = await pool.query(
      `SELECT d.id, d.title, d.original_filename, d.approval_status, d.created_at, d.updated_at
       FROM documents d
       INNER JOIN users u ON u.id = d.user_id AND u.company_id = ?
       WHERE d.user_id = ? AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [companyId, id]
    );
    res.json({ user: u, documents: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});

router.get('/team/:id/for-reset', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const companyId = req.session.companyId;
  if (!id || !companyId) return res.status(400).json({ error: 'Invalid request' });
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    const targetUser = rows[0];
    if (!targetUser || targetUser.role !== 'CLIENT') {
      return res.status(403).json({ error: 'You can only reset passwords for staff on your team.' });
    }
    res.json({ user: targetUser, message: req.query.message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load.' });
  }
});

router.get('/team', async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Your account is not linked to an organization.' });
    }
    const [companyRows] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
    const companyName = companyRows[0] ? companyRows[0].name : '';
    const [members] = await pool.query(
      `SELECT id, email, full_name, role, is_active, password_must_change, profile_completed, created_at,
              phone, emergency_contact_name, emergency_contact_phone, avatar_filename
       FROM users WHERE company_id = ? ORDER BY role DESC, full_name ASC`,
      [companyId]
    );
    const [docStats] = await pool.query(
      `SELECT u.id AS user_id,
              COUNT(d.id) AS documents_uploaded,
              SUM(CASE WHEN UPPER(TRIM(IFNULL(d.approval_status, ''))) = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
              SUM(CASE WHEN UPPER(TRIM(IFNULL(d.approval_status, ''))) = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count
       FROM users u
       LEFT JOIN documents d ON d.user_id = u.id AND d.deleted_at IS NULL
       WHERE u.company_id = ?
       GROUP BY u.id`,
      [companyId]
    );
    const statByUser = {};
    for (const row of docStats) {
      const uid = row.user_id;
      const uploaded = Number(row.documents_uploaded) || 0;
      const approved = Number(row.approved_count) || 0;
      const rejected = Number(row.rejected_count) || 0;
      const decided = approved + rejected;
      const approvalStars = decided > 0 ? Math.round((5 * approved) / decided) : 0;
      statByUser[uid] = { documentsUploaded: uploaded, approvalStars };
    }
    const membersOut = members.map((m) => {
      const s = statByUser[m.id] || { documentsUploaded: 0, approvalStars: 0 };
      const { avatar_filename: _af, ...rest } = m;
      return {
        ...rest,
        hasAvatar: !!(_af && String(_af).trim()),
        documentsUploaded: s.documentsUploaded,
        approvalStars: s.approvalStars,
      };
    });
    res.json({
      companyName,
      members: membersOut,
      message: req.query.message || '',
      currentUserId: req.session.userId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load team.' });
  }
});

module.exports = router;
