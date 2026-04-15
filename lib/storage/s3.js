const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const region = process.env.S3_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET || '';
const endpoint = process.env.S3_ENDPOINT || undefined;
const accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';

function assertConfig() {
  if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
}

const client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle: !!endpoint,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

async function putFileFromPath(localTempPath, key, contentType) {
  assertConfig();
  const body = fs.createReadStream(localTempPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );
}

async function getObjectStream(key) {
  assertConfig();
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return out.Body || null;
  } catch (e) {
    if (e && (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404)) return null;
    throw e;
  }
}

async function fileExists(key) {
  assertConfig();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function deleteObject(key) {
  assertConfig();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error('s3 deleteObject:', err.message);
  }
}

module.exports = {
  name: 's3',
  putFileFromPath,
  getObjectStream,
  fileExists,
  deleteObject,
};
