import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { auth } from '@/lib/auth';
import { buckets, getRangedObject, deleteObject } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Stream the hero video with HTTP Range support so the browser can seek.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      ownerId: galleries.userId,
      passwordHash: galleries.passwordHash,
      expiresAt: galleries.expiresAt,
      heroVideoKey: galleries.heroVideoKey,
      heroVideoMime: galleries.heroVideoMime,
    })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery || !gallery.heroVideoKey) return new Response('Not found', { status: 404 });
  if (gallery.expiresAt && gallery.expiresAt < new Date()) {
    return new Response('Gone', { status: 410 });
  }

  let allowed = await hasGalleryAccess(slug, gallery.passwordHash);
  if (!allowed) {
    const session = await auth();
    if (session?.user?.id === gallery.ownerId) allowed = true;
  }
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const range = req.headers.get('range') ?? undefined;

  // Track only the initial open (no Range, or Range starts at byte 0). Subsequent
  // seeks emit further Range requests we want to ignore.
  if (!range || /^bytes=0-/.test(range)) {
    const sessionId = await getOrSetClientSession();
    void recordEvent({ galleryId: gallery.id, eventType: 'hero_play', sessionId });
  }

  const res = await getRangedObject(buckets.originals, gallery.heroVideoKey, range);

  const headers = new Headers({
    'Content-Type': res.ContentType ?? gallery.heroVideoMime ?? 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });
  if (res.ContentLength != null) headers.set('Content-Length', String(res.ContentLength));
  if (res.ContentRange) headers.set('Content-Range', res.ContentRange);

  return new Response(res.Body as unknown as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}

// Admin-only: remove the hero video.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const [gallery] = await db
    .select({ id: galleries.id, key: galleries.heroVideoKey })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (gallery.key) {
    await deleteObject(buckets.originals, gallery.key).catch(() => {});
  }
  await db
    .update(galleries)
    .set({ heroVideoKey: null, heroVideoMime: null, heroVideoSizeBytes: null })
    .where(eq(galleries.id, gallery.id));

  return NextResponse.json({ ok: true });
}
