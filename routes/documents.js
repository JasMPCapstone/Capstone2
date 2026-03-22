const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

const uploadDir = path.join(process.cwd(), 'uploads');

function canAccessDocument(userId, role, doc) {
  if (role === 'ADMIN') return true;
  return doc && Number(doc.user_id) === Number(userId);
}

// Document types and tags (same as upload form)
const DOCUMENT_TYPES = [
  'Facility Accreditation Certificate',
  'Procurement Policy',
  'Floor Plan',
  'Inventory Report',
  'Compliance Certificate',
  'Other',
];

const TAGS = [
  'compliance',
  'inventory',
  'accreditation',
  'safety',
  'quality',
  'procurement',
  'regulatory',
  'financial',
  'other',
];

// List documents (client: own only; admin: all). Search and filter.
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const role = req.session.role;
    const q = (req.query.q || '').toString().trim();
    const documentType = (Array.isArray(req.query.documentType) ? req.query.documentType[0] : req.query.documentType || '').toString().trim();
    const tagsParam = req.query.tags;
    const tags = Array.isArray(tagsParam) ? tagsParam : (tagsParam ? [tagsParam] : []);
    const dateFrom = (req.query.dateFrom || '').trim();
    const dateTo = (req.query.dateTo || '').trim();
    const sort = (req.query.sort || 'date').toLowerCase();

    const baseWhere = role !== 'ADMIN' ? ' AND d.user_id = ?' : '';
    const baseParams = role !== 'ADMIN' ? [userId] : [];

    // Use predefined tags (same as upload form)
    const availableTags = [...TAGS];

    // document_type column added by migration on startup; may not exist if migration failed
    let hasDocumentType = true;
    try {
      await pool.query('SELECT document_type FROM documents LIMIT 1');
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') hasDocumentType = false;
    }

    const docTypeSelect = hasDocumentType ? 'd.document_type, ' : '';
    let sql = `
      SELECT d.id, d.user_id, d.filename, d.original_filename, d.file_type, d.file_extension, d.file_size, d.title, d.description, ${docTypeSelect}d.tags, d.created_at, d.updated_at,
             u.full_name AS owner_name, u.email AS owner_email
      FROM documents d
      JOIN users u ON u.id = d.user_id
      WHERE d.deleted_at IS NULL
    `;
    sql += baseWhere;
    const params = [...baseParams];

    if (q) {
      sql += ' AND (d.original_filename LIKE ? OR d.title LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (hasDocumentType && documentType && DOCUMENT_TYPES.includes(documentType)) {
      sql += ' AND LOWER(TRIM(COALESCE(d.document_type, ""))) = LOWER(?)';
      params.push(documentType);
    }
    if (tags.length > 0) {
      const validTags = tags.map((tag) => (tag || '').toString().trim().toLowerCase()).filter(Boolean);
      const tagConditions = validTags.map(() => `(
        LOWER(TRIM(d.tags)) = ? OR
        LOWER(d.tags) LIKE CONCAT(?, ',%') OR
        LOWER(d.tags) LIKE CONCAT('%,', ?, ',%') OR
        LOWER(d.tags) LIKE CONCAT('%,', ?)
      )`).join(' OR ');
      sql += ` AND (${tagConditions})`;
      validTags.forEach((t) => params.push(t, t, t, t));
    }
    if (dateFrom) {
      sql += ' AND d.created_at >= ?';
      params.push(dateFrom + ' 00:00:00');
    }
    if (dateTo) {
      sql += ' AND d.created_at <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    const orderBy = sort === 'name' ? 'd.title ASC, d.original_filename ASC' : sort === 'size' ? 'd.file_size DESC' : 'd.updated_at DESC';
    sql += ` ORDER BY ${orderBy}`;
    const [rows] = await pool.query(sql, params);
    res.render('documents/list', {
      documents: rows,
      query: req.query,
      availableTags,
      isAdmin: role === 'ADMIN',
      navActive: 'documents',
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load documents.' });
  }
});

// Upload form
router.get('/upload', (req, res) => {
  res.render('documents/upload', { navActive: 'upload' });
});

// Upload handler
router.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).render('documents/upload', { message: 'Please select a file (PDF, DOCX, or XLSX).', navActive: 'upload' });
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
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('document_type')) {
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
    } else throw colErr;
    }
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_UPLOAD',
      details: `id=${result.insertId} file=${req.file.originalname}`,
      req,
    });
    res.redirect('/documents');
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    console.error(err);
    res.status(500).render('documents/upload', { message: 'Upload failed. Please try again.', navActive: 'upload' });
  }
});

// Serve file inline for preview (e.g. in iframe)
router.get('/:id/view', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).redirect('/documents');
  try {
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id]);
    const doc = rows[0];
    if (!doc) return res.status(404).send('Not found');
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
      return res.status(403).send('Access denied');
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
      `SELECT d.*, u.full_name AS owner_name, u.email AS owner_email FROM documents d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
      return res.status(403).render('error', { message: 'You do not have access to this document.' });
    }
    res.render('documents/detail', { doc, isAdmin: req.session.role === 'ADMIN' });
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
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id]);
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('error', { message: 'File not found on server.' });
    }
    await log({
      userId: req.session.userId,
      action: 'DOCUMENT_DOWNLOAD',
      details: `id=${id} file=${doc.original_filename}`,
      req,
    });
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
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id]);
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    res.render('documents/edit', { doc, navActive: 'documents' });
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
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id]);
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
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
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [id]);
    const doc = rows[0];
    if (!doc) return res.status(404).render('error', { message: 'Document not found.' });
    if (!canAccessDocument(req.session.userId, req.session.role, doc)) {
      return res.status(403).render('error', { message: 'Access denied.' });
    }
    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
