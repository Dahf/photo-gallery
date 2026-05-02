import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { buckets, getObjectStream } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; photoId: string }> }
) {
  const { slug, photoId } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      passwordHash: galleries.passwordHash,
      downloadEnabled: galleries.downloadEnabled,
    })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery) return new Response('Not found', { status: 404 });
  if (!gallery.downloadEnabled) return new Response('Download disabled', { status: 403 });
  if (!(await hasGalleryAccess(slug, gallery.passwordHash))) {
    return new Response('Forbidden', { status: 403 });
  }

  const [photo] = await db
    .select({ filename: photos.filename, key: photos.s3KeyOriginal })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, gallery.id)))
    .limit(1);
  if (!photo) return new Response('Not found', { status: 404 });

  const body = await getObjectStream(buckets.originals, photo.key);
  if (!body) return new Response('Not found', { status: 404 });

  const sessionId = await getOrSetClientSession();
  void recordEvent({ galleryId: gallery.id, photoId, eventType: 'download', sessionId });

  return new Response(body as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${photo.filename.replace(/"/g, '')}"`,
    },
  });
}
