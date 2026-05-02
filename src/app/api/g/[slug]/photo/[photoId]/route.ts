import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { auth } from '@/lib/auth';
import { buckets, getObjectStream } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';

export const runtime = 'nodejs';

// Server-proxied image route. Streams thumb/web variants from MinIO after
// verifying either:
//   1. valid client gallery cookie (set after password unlock), OR
//   2. logged-in admin who owns the gallery.
//
// Since access is auth-gated, we tell shared caches (Cloudflare, proxies) to
// skip caching with `private` — the browser still caches per-user, and the
// content for any (id, variant) is immutable so it never needs revalidation.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; photoId: string }> }
) {
  const { slug, photoId } = await ctx.params;
  const variant = req.nextUrl.searchParams.get('v') === 'web' ? 'web' : 'thumb';

  const [gallery] = await db
    .select({
      id: galleries.id,
      ownerId: galleries.userId,
      passwordHash: galleries.passwordHash,
      expiresAt: galleries.expiresAt,
    })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery) return new Response('Not found', { status: 404 });
  if (gallery.expiresAt && gallery.expiresAt < new Date()) {
    return new Response('Gone', { status: 410 });
  }

  let allowed = await hasGalleryAccess(slug, gallery.passwordHash);
  if (!allowed) {
    const session = await auth();
    if (session?.user?.id === gallery.ownerId) allowed = true;
  }
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const [photo] = await db
    .select({ thumb: photos.s3KeyThumb, web: photos.s3KeyWeb })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, gallery.id)))
    .limit(1);
  if (!photo) return new Response('Not found', { status: 404 });

  const key = variant === 'web' ? photo.web : photo.thumb;
  const body = await getObjectStream(buckets.photos, key);
  if (!body) return new Response('Not found', { status: 404 });

  // Track lightbox views — thumbnails are noisy and would inflate counts.
  // Awaited (not fire-and-forget) because this route returns a streamed response;
  // an unawaited insert can be cancelled when the framework closes the request.
  if (variant === 'web') {
    const sessionId = await getOrSetClientSession();
    await recordEvent({ galleryId: gallery.id, photoId, eventType: 'view', sessionId });
  }

  return new Response(body as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  });
}
