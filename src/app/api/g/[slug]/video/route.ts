import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { auth } from '@/lib/auth';
import { buckets, presignGet, deleteObject } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Auth-gate the hero video, then redirect to a presigned S3 URL. The browser
// streams directly from S3 (with native Range support) — Cloudflare and our
// Node runtime stay out of the byte path.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      ownerId: galleries.userId,
      passwordHash: galleries.passwordHash,
      expiresAt: galleries.expiresAt,
      heroVideoKey: galleries.heroVideoKey,
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

  const sessionId = await getOrSetClientSession();
  await recordEvent({ galleryId: gallery.id, eventType: 'hero_play', sessionId });

  // Redirect to a presigned S3 URL so the browser fetches the video directly,
  // bypassing Cloudflare's 100 MB per-request body cap and our Node proxy.
  // S3 handles Range requests natively, so seeking just works.
  const url = await presignGet(buckets.originals, gallery.heroVideoKey, 3600);
  return Response.redirect(url, 302);
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
