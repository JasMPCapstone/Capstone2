/**
 * Storage abstraction: local disk under ./uploads or S3-compatible API.
 * The `documents.filename` column stores the object key for both drivers.
 */
let cached;

function driverName() {
  return (process.env.STORAGE_DRIVER || 'local').toLowerCase();
}

function getStorage() {
  if (!cached) {
    const d = driverName();
    cached = d === 's3' ? require('./s3') : require('./local');
  }
  return cached;
}

function isS3Storage() {
  return driverName() === 's3';
}

function resetStorageCache() {
  cached = undefined;
}

module.exports = {
  getStorage,
  isS3Storage,
  resetStorageCache,
  driverName,
};
