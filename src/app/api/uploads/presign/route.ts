import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { presignPut, buckets } from '@/lib/s3';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { galleryId?: string; filename?: string; contentType?: string };
  const galleryId = body.galleryId;
  const filename = body.filename ?? '';
  const contentType = body.contentType ?? 'application/octet-stream';
  if (!galleryId || !filename) {
    return NextResponse.json({ error: 'Missing galleryId or filename' }, { status: 400 });
  }

  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const key = `${galleryId}/${nanoid(16)}${ext}`;
  const uploadUrl = await presignPut(buckets.originals, key, contentType, 600);
  return NextResponse.json({ uploadUrl, key });
}
