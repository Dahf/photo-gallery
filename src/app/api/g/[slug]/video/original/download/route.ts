import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { auth } from '@/lib/auth';
import { buckets, presignGet } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      ownerId: galleries.userId,
      passwordHash: galleries.passwordHash,
      expiresAt: galleries.expiresAt,
      downloadEnabled: galleries.downloadEnabled,
      key: galleries.heroVideoOriginalKey,
      mime: galleries.heroVideoOriginalMime,
    })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery || !gallery.key) return new Response('Not found', { status: 404 });
  if (gallery.expiresAt && gallery.expiresAt < new Date()) {
    return new Response('Gone', { status: 410 });
  }

  // Owners always retain access; visitors are gated by both password and the gallery's
  // downloadEnabled toggle (mirrors photo download behaviour).
  let isOwner = false;
  const session = await auth();
  if (session?.user?.id === gallery.ownerId) isOwner = true;

  if (!isOwner) {
    if (!gallery.downloadEnabled) return new Response('Download disabled', { status: 403 });
    if (!(await hasGalleryAccess(slug, gallery.passwordHash))) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const sessionId = await getOrSetClientSession();
  await recordEvent({ galleryId: gallery.id, eventType: 'hero_download', sessionId });

  // Build a friendly download filename from the stored S3 key extension.
  const ext = gallery.key.includes('.') ? gallery.key.slice(gallery.key.lastIndexOf('.')) : '';
  const filename = `hero-video${ext}`;

  // Redirect to a presigned URL so the browser downloads directly from S3,
  // avoiding Cloudflare's per-request body cap on large originals.
  const url = await presignGet(buckets.originals, gallery.key, 3600, {
    responseContentDisposition: `attachment; filename="${filename}"`,
    responseContentType: gallery.mime ?? 'application/octet-stream',
  });
  return Response.redirect(url, 302);
}
