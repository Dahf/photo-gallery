// Lazy env access — values are validated on first read, not at module load.
// This lets `next build` import route modules without all envs set.

const optional = new Set(['S3_REGION', 'S3_BUCKET_ORIGINALS', 'S3_BUCKET_PHOTOS', 'APP_URL']);

const defaults: Record<string, string> = {
  S3_REGION: 'us-east-1',
  S3_BUCKET_ORIGINALS: 'originals',
  S3_BUCKET_PHOTOS: 'photos',
  APP_URL: 'http://localhost:3000',
};

type EnvKeys =
  | 'DATABASE_URL'
  | 'AUTH_SECRET'
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_ACCESS_KEY'
  | 'S3_SECRET_KEY'
  | 'S3_BUCKET_ORIGINALS'
  | 'S3_BUCKET_PHOTOS'
  | 'PHOTOS_PUBLIC_BASE_URL'
  | 'APP_URL';

export const env = new Proxy({} as Record<EnvKeys, string>, {
  get(_, key: string) {
    const value = process.env[key];
    if (value && value.length > 0) return value;
    if (optional.has(key)) return defaults[key];
    throw new Error(`Missing env: ${key}`);
  },
});
