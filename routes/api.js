const express = require('express');
const cors = require('cors');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { enforceOnboarding } = require('../middleware/onboarding');
const { queryDocumentList } = require('../lib/services/documentsList');
const { apiGeneral: apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

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

router.get('/me', requireAuth, enforceOnboarding, (req, res) => {
  res.json({
    userId: req.session.userId,
    email: req.session.email,
    fullName: req.session.fullName,
    role: req.session.role,
    companyId: req.session.companyId,
  });
});

router.get('/documents', requireAuth, enforceOnboarding, apiLimiter, async (req, res) => {
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
      activeTab: list.activeTab,
      hasApprovalStatus: list.hasApprovalStatus,
      companiesForFilter: list.companiesForFilter,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});

module.exports = router;
