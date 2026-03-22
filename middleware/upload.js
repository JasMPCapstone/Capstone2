const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || 'pdf,docx,xlsx,doc,xls,png,jpg,jpeg').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_SET = new Set(ALLOWED_EXTENSIONS);
const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10); // 10MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/^\./, '') || 'bin';
    const safe = ALLOWED_SET.has(ext) ? ext : 'bin';
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${safe}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/^\./, '');
  if (!ext || !ALLOWED_SET.has(ext)) {
    return cb(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = { upload, ALLOWED_EXTENSIONS, MAX_SIZE };
