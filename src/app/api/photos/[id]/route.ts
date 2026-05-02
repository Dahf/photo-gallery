import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { buckets, deleteObject } from '@/lib/s3';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  const [photo] = await db
    .select({
      id: photos.id,
      galleryId: photos.galleryId,
      s3KeyOriginal: photos.s3KeyOriginal,
      s3KeyWeb: photos.s3KeyWeb,
      s3KeyThumb: photos.s3KeyThumb,
      ownerId: galleries.userId,
      coverPhotoId: galleries.coverPhotoId,
    })
    .from(photos)
    .innerJoin(galleries, eq(galleries.id, photos.galleryId))
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (photo.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (photo.coverPhotoId === photo.id) {
    await db
      .update(galleries)
      .set({ coverPhotoId: sql`NULL` })
      .where(eq(galleries.id, photo.galleryId));
  }

  await db.delete(photos).where(and(eq(photos.id, photo.id), eq(photos.galleryId, photo.galleryId)));

  // Best-effort S3 cleanup. If a key is already gone, MinIO returns 204 anyway.
  await Promise.allSettled([
    deleteObject(buckets.originals, photo.s3KeyOriginal),
    deleteObject(buckets.photos, photo.s3KeyWeb),
    deleteObject(buckets.photos, photo.s3KeyThumb),
  ]);

  return NextResponse.json({ ok: true });
}
