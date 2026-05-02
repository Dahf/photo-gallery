import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

let _client: S3Client | undefined;
function client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
  });
  return _client;
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
    client(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}

export async function getObjectStream(bucket: string, key: string) {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body;
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
  await client().send(
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
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function publicPhotoUrl(key: string): string {
  return `${env.PHOTOS_PUBLIC_BASE_URL}/${key}`;
}
