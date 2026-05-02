import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

// Internal client — used by the server for direct ops (sharp processing, ZIP streams).
let _internal: S3Client | undefined;
function internalClient(): S3Client {
  if (_internal) return _internal;
  _internal = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });
  return _internal;
}

// Public-facing client — used to *generate* presigned URLs that the BROWSER will hit.
// Falls back to S3_ENDPOINT if S3_PUBLIC_ENDPOINT is not set (dev / single-host setups).
let _public: S3Client | undefined;
function publicClient(): S3Client {
  if (_public) return _public;
  const endpoint = env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT;
  _public = new S3Client({
    endpoint,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });
  return _public;
}

export const buckets = {
  get originals() {
    return env.S3_BUCKET_ORIGINALS;
  },
  get photos() {
    return env.S3_BUCKET_PHOTOS;
  },
};

export async function presignPut(bucket: string, key: string, contentType: string, expiresInSeconds = 600) {
  return getSignedUrl(
    publicClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}

export async function getObjectStream(bucket: string, key: string) {
  const res = await internalClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body;
}

// For range-aware streaming (e.g. video seeking). Returns the full S3 response
// so callers can forward Content-Length / Content-Range headers.
export async function getRangedObject(bucket: string, key: string, range?: string) {
  return internalClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key, ...(range ? { Range: range } : {}) })
  );
}

export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const body = await getObjectStream(bucket, key);
  if (!body) throw new Error(`Empty object: ${bucket}/${key}`);
  const chunks: Uint8Array[] = [];
  // @ts-expect-error - SDK Body is a ReadableStream/Readable union
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function putObject(bucket: string, key: string, body: Buffer, contentType: string) {
  await internalClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

export async function deleteObject(bucket: string, key: string) {
  await internalClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function publicPhotoUrl(key: string): string {
  return `${env.PHOTOS_PUBLIC_BASE_URL}/${key}`;
}

// Server-proxied image URL — auth-gated, replaces direct CDN access for thumb/web.
export function photoUrl(slug: string, photoId: string, variant: 'thumb' | 'web' = 'thumb'): string {
  return `/api/g/${slug}/photo/${photoId}?v=${variant}`;
}
