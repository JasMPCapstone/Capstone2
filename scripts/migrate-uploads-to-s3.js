/**
 * Copy existing local files from ./uploads to S3 (excluding uploads/tmp).
 * Set STORAGE_DRIVER=s3 and S3_* env vars before running.
 *
 * Usage: node scripts/migrate-uploads-to-s3.js [--dry-run]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const dryRun = process.argv.includes('--dry-run');
const uploadDir = path.join(process.cwd(), 'uploads');
const bucket = process.env.S3_BUCKET || '';
const region = process.env.S3_REGION || 'us-east-1';
const endpoint = process.env.S3_ENDPOINT || undefined;

if (!bucket) {
  console.error('Set S3_BUCKET and run with STORAGE_DRIVER=s3 configured.');
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle: !!endpoint,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
});

async function existsOnS3(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(localPath, key, contentType) {
  const { createReadStream } = require('fs');
  const body = createReadStream(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );
}

async function main() {
  const { pool } = require('../config/database');
  const [rows] = await pool.query('SELECT id, filename, file_type FROM documents WHERE deleted_at IS NULL');
  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const row of rows) {
    const key = row.filename;
    const localPath = path.join(uploadDir, key);
    if (!fs.existsSync(localPath)) {
      console.warn('Missing local file, skip:', key);
      skip += 1;
      continue;
    }
    if (localPath.includes(`${path.sep}tmp${path.sep}`)) {
      skip += 1;
      continue;
    }
    if (await existsOnS3(key)) {
      console.log('Already on S3:', key);
      skip += 1;
      continue;
    }
    if (dryRun) {
      console.log('[dry-run] would upload', key);
      ok += 1;
      continue;
    }
    try {
      await uploadFile(localPath, key, row.file_type);
      console.log('Uploaded', key);
      ok += 1;
    } catch (e) {
      console.error('Failed', key, e.message);
      fail += 1;
    }
  }
  console.log(`Done. uploaded=${ok} skipped=${skip} failed=${fail} dryRun=${dryRun}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
