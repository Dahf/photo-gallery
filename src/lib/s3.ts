import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
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

// Presigned GET — used to redirect the browser straight to S3 for large objects
// (videos), bypassing Cloudflare's per-request body cap and our Node proxy.
// `responseContentDisposition` lets us force a download filename without proxying.
export async function presignGet(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
  opts: { responseContentDisposition?: string; responseContentType?: string } = {}
) {
  return getSignedUrl(
    publicClient(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(opts.responseContentDisposition
        ? { ResponseContentDisposition: opts.responseContentDisposition }
        : {}),
      ...(opts.responseContentType ? { ResponseContentType: opts.responseContentType } : {}),
    }),
    { expiresIn: expiresInSeconds }
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

// ---- Multipart upload (browser-driven, big-file friendly) ---------------

export async function createMultipartUpload(
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const res = await internalClient().send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  );
  if (!res.UploadId) throw new Error('S3 did not return an UploadId');
  return res.UploadId;
}

export async function presignUploadPart(
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresInSeconds = 1800
): Promise<string> {
  return getSignedUrl(
    publicClient(),
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<void> {
  await internalClient().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await internalClient().send(
    new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
  );
}
