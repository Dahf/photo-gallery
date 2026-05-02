import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

export const buckets = {
  originals: env.S3_BUCKET_ORIGINALS,
  photos: env.S3_BUCKET_PHOTOS,
};

export async function presignPut(bucket: string, key: string, contentType: string, expiresInSeconds = 600) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}

export async function getObjectStream(bucket: string, key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body;
}

export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const body = await getObjectStream(bucket, key);
  if (!body) throw new Error(`Empty object: ${bucket}/${key}`);
  // Web stream from AWS SDK v3
  const chunks: Uint8Array[] = [];
  // @ts-expect-error - SDK Body is a ReadableStream/Readable union
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function putObject(bucket: string, key: string, body: Buffer, contentType: string) {
  await s3.send(
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
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function publicPhotoUrl(key: string): string {
  return `${env.PHOTOS_PUBLIC_BASE_URL}/${key}`;
}
