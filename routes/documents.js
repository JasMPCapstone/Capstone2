const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');
const { requireAuth } = require('../middleware/auth');
const { enforceOnboarding } = require('../middleware/onboarding');
const { isSystemAdmin, isClientAdmin } = require('../lib/roles');
const { upload } = require('../middleware/upload');
const { documentUpload: uploadLimiter } = require('../middleware/rateLimit');
const { getStorage, isS3Storage } = require('../lib/storage');

const router = express.Router();
router.use(requireAuth);
router.use(enforceOnboarding);

const uploadDir = path.join(process.cwd(), 'uploads');

function safeReturnTo(body, fallback = '/documents') {
  const r = body && body.returnTo != null ? body.returnTo.toString().trim() : '';
  if (r === '/' || r === '/documents') return r;
  if (r.startsWith('/documents?')) return r;
  if (/^\/documents\/\d+$/.test(r)) return r;
  return fallback;
}

function redirectDocumentEditError(req, res, message) {
  const dest = safeReturnTo(req.body, '/documents');
  if (dest === '/') {
    return res.redirect(`/?message=${encodeURIComponent(message)}`);
  }
  const sep = dest.includes('?') ? '&' : '?';
  return res.redirect(`${dest}${sep}error=${encodeURIComponent(message)}`);
}

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

// Upload handler
router.post('/upload', uploadLimiter, upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.redirect('/documents/upload?error=' + encodeURIComponent('Please select a file (PDF, DOCX, JPG, XLSX, or CSV).'));
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
    res.redirect('/documents/upload?error=' + encodeURIComponent('Upload failed. Please try again.'));
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
    if (!doc) return res.status(404).send('Not found');
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).send('Access denied');
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
        return res.status(404).send('File not found on server');
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
      return res.status(404).send('File not found on server');
    }
    res.download(filePath, doc.original_filename);
  } catch (err) {
    console.error(err);
    res.status(500).send('Download failed');
  }
});

// Update metadata and optionally replace file (resets approval when file changes or doc was rejected)
router.post(
  '/:id/edit',
  uploadLimiter,
  (req, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return redirectDocumentEditError(req, res, 'File too large. Max size is 10MB.');
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return redirectDocumentEditError(req, res, err.message);
        }
        console.error(err);
        return redirectDocumentEditError(req, res, 'Upload failed. Please try again.');
      }
      next();
    });
  },
  async (req, res) => {
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
      if (!doc) return res.status(404).send('Not found');
      if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
        return res.status(403).send('Access denied');
      }

      if (req.file) {
        const oldFilename = doc.filename;
        try {
          if (isS3Storage()) {
            const storage = getStorage();
            await storage.deleteObject(oldFilename);
            await storage.putFileFromPath(req.file.path, req.file.filename, req.file.mimetype);
            fs.unlink(req.file.path, () => {});
          } else {
            const oldPath = path.join(uploadDir, oldFilename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
        } catch (fileErr) {
          if (req.file && req.file.path && isS3Storage()) fs.unlink(req.file.path, () => {});
          console.error(fileErr);
          return res.status(500).send('Could not replace file.');
        }

        const fileType = (req.file.mimetype || 'application/octet-stream').slice(0, 255);
        const ext =
          path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase() ||
          path.extname(req.file.filename || '').replace(/^\./, '').toLowerCase() ||
          'bin';
        const origName = (req.file.originalname || req.file.filename || '').toString().slice(0, 255);
        const titleVal = title || origName;

        try {
          await pool.query(
            `UPDATE documents SET filename = ?, original_filename = ?, file_type = ?, file_extension = ?, file_size = ?, title = ?, description = ?, document_type = ?, tags = ?, approval_status = 'PENDING', approval_rejection_reason = NULL WHERE id = ?`,
            [
              req.file.filename,
              origName,
              fileType,
              ext,
              req.file.size,
              titleVal,
              description || null,
              documentType,
              tags || null,
              id,
            ]
          );
        } catch (colErr) {
          if (colErr.code === 'ER_BAD_FIELD_ERROR') {
            await pool.query(
              `UPDATE documents SET filename = ?, original_filename = ?, file_type = ?, file_extension = ?, file_size = ?, title = ?, description = ?, document_type = ?, tags = ? WHERE id = ?`,
              [
                req.file.filename,
                origName,
                fileType,
                ext,
                req.file.size,
                titleVal,
                description || null,
                documentType,
                tags || null,
                id,
              ]
            );
          } else throw colErr;
        }
      } else {
        const titleVal = title || doc.original_filename;
        const st = String(doc.approval_status || '').toUpperCase();
        if (st === 'REJECTED') {
          try {
            await pool.query(
              'UPDATE documents SET title = ?, description = ?, document_type = ?, tags = ?, approval_status = ?, approval_rejection_reason = ? WHERE id = ?',
              [titleVal, description || null, documentType, tags || null, 'PENDING', null, id]
            );
          } catch (colErr) {
            if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('document_type')) {
              try {
                await pool.query(
                  'UPDATE documents SET title = ?, description = ?, tags = ?, approval_status = ?, approval_rejection_reason = ? WHERE id = ?',
                  [titleVal, description || null, tags || null, 'PENDING', null, id]
                );
              } catch (e2) {
                if (e2.code === 'ER_BAD_FIELD_ERROR') {
                  await pool.query('UPDATE documents SET title = ?, description = ?, tags = ? WHERE id = ?', [
                    titleVal,
                    description || null,
                    tags || null,
                    id,
                  ]);
                } else throw e2;
              }
            } else if (colErr.code === 'ER_BAD_FIELD_ERROR') {
              await pool.query(
                'UPDATE documents SET title = ?, description = ?, document_type = ?, tags = ? WHERE id = ?',
                [titleVal, description || null, documentType, tags || null, id]
              );
            } else throw colErr;
          }
        } else {
          try {
            await pool.query(
              'UPDATE documents SET title = ?, description = ?, document_type = ?, tags = ? WHERE id = ?',
              [titleVal, description || null, documentType, tags || null, id]
            );
          } catch (colErr) {
            if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message && colErr.message.includes('document_type')) {
              await pool.query('UPDATE documents SET title = ?, description = ?, tags = ? WHERE id = ?', [
                titleVal,
                description || null,
                tags || null,
                id,
              ]);
            } else throw colErr;
          }
        }
      }

      await log({
        userId: req.session.userId,
        action: 'DOCUMENT_EDIT',
        details: `id=${id} title=${title} file_replace=${!!req.file}`,
        req,
      });
      res.redirect(safeReturnTo(req.body, '/documents'));
    } catch (err) {
      console.error(err);
      res.status(500).send('Update failed');
    }
  }
);

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
    if (!doc) return res.status(404).send('Not found');
    if (!canAccessDocument(req.session.userId, req.session.role, req.session.companyId, doc)) {
      return res.status(403).send('Access denied');
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
    res.redirect(safeReturnTo(req.body, '/documents'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Delete failed');
  }
});

module.exports = router;
