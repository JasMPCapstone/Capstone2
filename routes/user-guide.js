const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireApiSession, requireApiSystemAdmin } = require('../middleware/authApi');
const { getStorage, isCloudStorage, driverName } = require('../lib/storage');
const { pool } = require('../config/database');
const { log } = require('../lib/audit');

const USER_GUIDE_MAX_BYTES = parseInt(process.env.USER_GUIDE_MAX_BYTES || String(25 * 1024 * 1024), 10);
const USER_GUIDE_KEY = (process.env.USER_GUIDE_OBJECT_KEY || 'user-guide/current.pdf').trim();
const userGuideDir = path.join(process.cwd(), 'uploads', 'user-guide');
const userGuideLocalPath = path.join(userGuideDir, 'current.pdf');

// ── app_settings helpers ────────────────────────────────────────────────────
async function getUserGuideUrl() {
  try {
    const [rows] = await pool.query(`SELECT value FROM app_settings WHERE key = 'user_guide_url'`);
    return rows[0] ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setUserGuideUrl(url) {
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('user_guide_url', ?)
       ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = NOW()`,
      [url, url]
    );
  } catch (err) {
    console.error('setUserGuideUrl:', err.message);
  }
}
// ───────────────────────────────────────────────────────────────────────────

// Cloud drivers (s3, blob) use memory storage — no temp directory needed on the filesystem.
// Local driver writes to disk as before.
const userGuideStorage = isCloudStorage()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const tmpDir = path.join(userGuideDir, 'tmp');
        fs.mkdirSync(tmpDir, { recursive: true });
        cb(null, tmpDir);
      },
      filename: (req, file, cb) => cb(null, `ug-${Date.now()}.pdf`),
    });

const userGuideUpload = multer({
  storage: userGuideStorage,
  limits: { fileSize: USER_GUIDE_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const ok =
      ext === '.pdf' &&
      (!mime || ['application/pdf', 'application/x-pdf', 'binary/octet-stream', 'application/octet-stream'].includes(mime));
    cb(ok ? null : new Error('Only PDF files are allowed'), ok);
  },
});

const router = express.Router();

router.get('/user-guide/status', requireApiSession, async (req, res) => {
  try {
    if (isCloudStorage()) {
      if (driverName() === 'blob') {
        const url = await getUserGuideUrl();
        if (!url) return res.json({ available: false });
        const meta = await getStorage().headMetadata(url);
        if (!meta) return res.json({ available: false });
        return res.json({ available: true, updatedAt: meta.lastModified || undefined });
      }
      // S3
      const meta = await getStorage().headMetadata(USER_GUIDE_KEY);
      if (!meta) return res.json({ available: false });
      return res.json({ available: true, updatedAt: meta.lastModified || undefined });
    }
    if (!fs.existsSync(userGuideLocalPath)) return res.json({ available: false });
    const st = await fs.promises.stat(userGuideLocalPath);
    return res.json({ available: true, updatedAt: st.mtime.toISOString() });
  } catch (err) {
    console.error('user-guide status:', err);
    return res.status(500).json({ error: 'Could not read user guide status' });
  }
});

router.get('/user-guide/file', requireApiSession, async (req, res) => {
  try {
    if (isCloudStorage()) {
      let storageKey;
      if (driverName() === 'blob') {
        storageKey = await getUserGuideUrl();
      } else {
        const exists = await getStorage().fileExists(USER_GUIDE_KEY);
        storageKey = exists ? USER_GUIDE_KEY : null;
      }
      if (!storageKey) return res.status(404).type('text').send('User guide not available');
      const stream = await getStorage().getObjectStream(storageKey);
      if (!stream) return res.status(404).type('text').send('User guide not available');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="user-guide.pdf"');
      res.setHeader('Cache-Control', 'private, max-age=120');
      stream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
      stream.pipe(res);
      return;
    }
    if (!fs.existsSync(userGuideLocalPath)) return res.status(404).type('text').send('User guide not available');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="user-guide.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.sendFile(userGuideLocalPath, (err) => {
      if (err && !res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.error('user-guide file:', err);
    if (!res.headersSent) res.status(500).type('text').send('Could not load user guide');
  }
});

router.post(
  '/user-guide',
  requireApiSystemAdmin,
  (req, res, next) => {
    userGuideUpload.single('pdf')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `PDF must be under ${Math.round(USER_GUIDE_MAX_BYTES / (1024 * 1024))} MB` });
        }
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF file' });
    try {
      if (driverName() === 'blob') {
        // Delete old file if present
        const oldUrl = await getUserGuideUrl();
        if (oldUrl) {
          try { await getStorage().deleteObject(oldUrl); } catch (_) {}
        }
        const blobUrl = await getStorage().putBuffer(req.file.buffer, USER_GUIDE_KEY, 'application/pdf');
        await setUserGuideUrl(blobUrl);
      } else if (driverName() === 's3') {
        await getStorage().putBuffer(req.file.buffer, USER_GUIDE_KEY, 'application/pdf');
      } else {
        const tempPath = req.file.path;
        try {
          await fs.promises.mkdir(userGuideDir, { recursive: true });
          const buf = await fs.promises.readFile(tempPath);
          await fs.promises.writeFile(userGuideLocalPath, buf);
        } finally {
          try { if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath); } catch (_) {}
        }
      }

      await log({
        userId: req.session.userId,
        action: 'USER_GUIDE_REPLACED',
        details: `storage=${driverName()}`,
        req,
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error('user-guide upload:', err);
      return res.status(500).json({ error: 'Could not save user guide' });
    }
  }
);

module.exports = router;
