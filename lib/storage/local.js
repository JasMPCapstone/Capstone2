const fs = require('fs');
const path = require('path');

const uploadDir = path.join(process.cwd(), 'uploads');

function assertSafeKey(key) {
  const k = (key || '').toString();
  if (!k || k.includes('..') || path.isAbsolute(k) || k.includes('/') || k.includes('\\')) {
    throw new Error('Invalid storage key');
  }
}

function localPath(key) {
  assertSafeKey(key);
  return path.join(uploadDir, key);
}

async function putFileFromPath(localTempPath, key, _contentType) {
  assertSafeKey(key);
  const dest = localPath(key);
  await fs.promises.rename(localTempPath, dest);
}

async function getObjectStream(key) {
  try {
    const p = localPath(key);
    if (!fs.existsSync(p)) return null;
    return fs.createReadStream(p);
  } catch {
    return null;
  }
}

async function fileExists(key) {
  try {
    return fs.existsSync(localPath(key));
  } catch {
    return false;
  }
}

async function deleteObject(key) {
  try {
    const p = localPath(key);
    if (fs.existsSync(p)) await fs.promises.unlink(p);
  } catch (err) {
    console.error('local deleteObject:', err.message);
  }
}

module.exports = {
  name: 'local',
  putFileFromPath,
  getObjectStream,
  fileExists,
  deleteObject,
  uploadDir,
};
