import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buckets, putObject } from '@/lib/s3';

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

  // Deterministic key — overwrites the previous logo, content-type is stored on
  // the object so the proxy route can serve it back with the right MIME.
  const key = `branding/${session.user.id}/logo`;

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject(buckets.photos, key, buf, file.type);

  // Cache-busting query param so the browser picks up the new image immediately.
  const url = `/api/u/${session.user.id}/logo?v=${Date.now()}`;
  await db.update(users).set({ logoUrl: url }).where(eq(users.id, session.user.id));

  return NextResponse.json({ url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db.update(users).set({ logoUrl: null }).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
