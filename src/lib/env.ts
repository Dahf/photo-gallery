function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  AUTH_SECRET: required('AUTH_SECRET'),
  S3_ENDPOINT: required('S3_ENDPOINT'),
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_ACCESS_KEY: required('S3_ACCESS_KEY'),
  S3_SECRET_KEY: required('S3_SECRET_KEY'),
  S3_BUCKET_ORIGINALS: process.env.S3_BUCKET_ORIGINALS ?? 'originals',
  S3_BUCKET_PHOTOS: process.env.S3_BUCKET_PHOTOS ?? 'photos',
  PHOTOS_PUBLIC_BASE_URL: required('PHOTOS_PUBLIC_BASE_URL'),
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
};
