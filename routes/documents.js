const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const { requireAuth } = require('../middleware/auth');
const { enforceOnboarding } = require('../middleware/onboarding');
const { isSystemAdmin, isClientAdmin } = require('../lib/roles');
const { upload } = require('../middleware/upload');
const { documentUpload: uploadLimiter } = require('../middleware/rateLimit');
const { getStorage, isS3Storage } = require('../lib/storage');
const {
  DOCUMENT_TYPES,
  TAGS,
  buildDocumentsListUrl,
  queryDocumentList,
} = require('../lib/services/documentsList');

const router = express.Router();
router.use(requireAuth);
router.use(enforceOnboarding);

const uploadDir = path.join(process.cwd(), 'uploads');

function canAccessDocument(userId, role, companyId, doc) {
  if (!doc) return false;
  if (isSystemAdmin(role)) return true;
  if (Number(doc.user_id) === Number(userId)) return true;
  if (
    isClientAdmin(role) &&
    companyId != null &&
    doc.owner_company_id != null &&
    Number(doc.owner_company_id) === Number(companyId)
  ) {
    return true;
  }
  return false;
}

// List documents (client: own only; admin: all). Search and filter.
router.get('/', async (req, res) => {
  try {
    const role = req.session.role;
    const list = await queryDocumentList(
      pool,
      {
        userId: req.session.userId,
        role: req.session.role,
        companyId: req.session.companyId,
      },
      req.query
    );
    const { rows, hasApprovalStatus, activeTab, companiesForFilter, availableTags } = list;

    let docPageTitle = 'My Documents';
    if (isSystemAdmin(role)) docPageTitle = 'All documents';
    else if (isClientAdmin(role)) docPageTitle = 'Company documents';

    const queryForUrls = req.query;
    const listLocals = {
      documents: rows,
      query: req.query,
      activeTab,
      docListUrl: (overrides) => buildDocumentsListUrl(queryForUrls, overrides),
      availableTags,
      companiesForFilter,
      hasApprovalStatus,
      isAdmin: isSystemAdmin(role) || isClientAdmin(role),
      docPageTitle,
      navActive: 'documents',
    };
    if (isSystemAdmin(role)) listLocals.adminPageTitle = 'Documents';
    res.render('documents/list', listLocals);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load documents.' });
  }
});

// Upload form
router.get('/upload', (req, res) => {
  const locals = { navActive: 'upload' };
  if (isSystemAdmin(req.session.role)) locals.adminPageTitle = 'Upload document';
  res.render('documents/upload', locals);
});

// Upload handler
router.post('/upload', uploadLimiter, upload.single('document'), async (req, res) => {
  if (!req.file) {
    const upErr = { message: 'Please select a file (PDF, DOCX, JPG, XLSX, or CSV).', navActive: 'upload' };
    if (isSystemAdmin(req.session.role)) upErr.adminPageTitle = 'Upload document';
    return res.status(400).render('documents/upload', upErr);
  }
  const title = (req.body.title || req.file.originalname || '').toString().trim().slice(0, 255);
  const description = (req.body.description || '').toString().trim().slice(0, 2000);
  const documentType = (req.body.documentType || '').toString().trim().slice(0, 100) || null;
  const tags = (req.body.tags || '').toString().trim().slice(0, 500);
  const fileType = (req.file.mimetype || 'application/octet-stream').slice(0, 255);

  try {
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO documents (user_id, filename, original_filename, file_type, file_extension, file_size, title, description, document_type, tags, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          req.session.userId,
          req.file.filename,
          req.file.originalname || req.file.filename,
          fileType,
          path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase() || 'bin',
          req.file.size,
          title || req.file.originalname,
          description || null,
          documentType,
          tags || null,
        ]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('document_type')) {
        try {
          [result] = await pool.query(
            `INSERT INTO documents (user_id, filename, original_filename, file_type, file_extension, file_size, title, description, tags, approval_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              req.session.userId,
              req.file.filename,
              req.file.originalname || req.file.filename,
              fileType,
              path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase() || 'bin',
              req.file.size,
              title || req.file.originalname,
              description || null,
              tags || null,
            ]
          );
        } catch (colErr2) {
          if (colErr2.code === 'ER_BAD_FIELD_ERROR' && colErr2.message && colErr2.message.includes('approval_status')) {
            [result] = await pool.query(
              `INSERT INTO documents (user_id, filename, original_filename, file_type, file_extension, file_size, title, description, tags)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                req.session.userId,
                req.file.filename,
                req.file.originalname || req.file.filename,
                fileType,
                path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase() || 'bin',
                req.file.size,
                title || req.file.originalname,
                description || null,
                tags || null,
              ]
            );
          } else throw colErr2;
        }
      } else if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('approval_status')) {
        [result] = await pool.query(
          `INSERT INTO documents (user_id, filename, original_filename, file_type, file_extension, file_size, title, description, document_type, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.session.userId,
            req.file.filename,
            req.file.originalname || req.file.filename,
            fileType,
            path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase() || 'bin',
            req.file.size,
            title || req.file.originalname,
            description || null,
            documentType,
            tags || null,
          ]
        );
      } else throw colErr;
    }
    if (isS3Storage()) {
      const storage = getStorage();
      try {
        await storage.putFileFromPath(req.file.path, req.file.filename, req.file.mimetype);
      } catch (upErr) {
        await pool.query('DELETE FROM documents WHERE id = ?', [result.insertId]);
        throw upErr;
      }
      fs.unlink(req.file.path, () => {});
    }

    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_UPLOAD',
      details: `id=${result.insertId} file=${req.file.originalname} storage=${isS3Storage() ? 's3' : 'local'}`,
      req,
    });
    res.redirect('/documents');
  } catch (err) {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    console.error(err);
    const upFail = { message: 'Upload failed. Please try again.', navActive: 'upload' };
    if (isSystemAdmin(req.session.role)) upFail.adminPageTitle = 'Upload document';
    res.status(500).render('documents/upload', upFail);
  }
});

// Serve file inline for preview (e.g. in iframe)
router.get('/:id/view', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).send('Not found');
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).send('Access denied');
    }
    if (isS3Storage()) {
      const storage = getStorage();
      const stream = await storage.getObjectStream(doc.filename);
      if (!stream) return res.status(404).send('File not found');
      res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(doc.original_filename) + '"');
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
      return;
    }
    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(doc.original_filename) + '"');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// View single document (metadata)
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
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
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).render('error', { message: 'You do not have access to this document.' });
    }
    const detailLocals = {
      doc,
      isAdmin: isSystemAdmin(req.session.role) || isClientAdmin(req.session.role),
      navActive: 'documents',
    };
    if (isSystemAdmin(req.session.role)) {
      detailLocals.adminPageTitle = (doc.title || doc.original_filename || 'Document').toString().slice(0, 72);
    }
    res.render('documents/detail', detailLocals);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load document.' });
  }
});

// Download
router.get('/:id/download', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_DOWNLOAD',
      details: `id=${id} file=${doc.original_filename}`,
      req,
    });
    if (isS3Storage()) {
      const storage = getStorage();
      const stream = await storage.getObjectStream(doc.filename);
      if (!stream) {
        return res.status(404).render('error', { message: 'File not found on server.' });
      }
      res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(doc.original_filename) + '"');
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
      return;
    }
    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('error', { message: 'File not found on server.' });
    }
    res.download(filePath, doc.original_filename);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Download failed.' });
  }
});

// Edit metadata form
router.get('/:id/edit', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    const editLocals = { doc, navActive: 'documents' };
    if (isSystemAdmin(req.session.role)) {
      editLocals.adminPageTitle = `Edit · ${(doc.title || doc.original_filename || '').toString().slice(0, 48)}`;
    }
    res.render('documents/edit', editLocals);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load document.' });
  }
});

// Update metadata
router.post('/:id/edit', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  const title = (req.body.title || '').toString().trim().slice(0, 255);
  const description = (req.body.description || '').toString().trim().slice(0, 2000);
  const tags = (req.body.tags || '').toString().trim().slice(0, 500);
  const documentType = (req.body.documentType || '').toString().trim().slice(0, 100) || null;

  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    try {
      await pool.query(
        'UPDATE documents SET title = ?, description = ?, document_type = ?, tags = ? WHERE id = ?',
        [title || doc.original_filename, description || null, documentType, tags || null, id]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('document_type')) {
        await pool.query(
          'UPDATE documents SET title = ?, description = ?, tags = ? WHERE id = ?',
          [title || doc.original_filename, description || null, tags || null, id]
        );
      } else throw colErr;
    }
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_EDIT',
      details: `id=${id} title=${title}`,
      req,
    });
    res.redirect('/documents');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Update failed.' });
  }
});

// Delete (hard delete: remove file and metadata)
router.post('/:id/delete', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.company_id AS owner_company_id FROM documents d
       JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    if (isS3Storage()) {
      const storage = getStorage();
      await storage.deleteObject(doc.filename);
    } else {
      const filePath = path.join(uploadDir, doc.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('DELETE FROM documents WHERE id = ?', [id]);
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_DELETE',
      details: `id=${id} file=${doc.original_filename}`,
      req,
    });
    res.redirect('/documents');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Delete failed.' });
  }
});

module.exports = router;
