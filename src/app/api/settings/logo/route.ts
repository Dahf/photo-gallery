import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buckets, putObject, publicPhotoUrl } from '@/lib/s3';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use PNG, JPEG, WebP, or SVG.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Max 5 MB.' }, { status: 400 });
  }

  const extByMime: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  const ext = extByMime[file.type] ?? '';
  const key = `branding/${session.user.id}/logo-${nanoid(10)}${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject(buckets.photos, key, buf, file.type);

  const url = publicPhotoUrl(key);
  await db.update(users).set({ logoUrl: url }).where(eq(users.id, session.user.id));

  return NextResponse.json({ url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db.update(users).set({ logoUrl: null }).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
