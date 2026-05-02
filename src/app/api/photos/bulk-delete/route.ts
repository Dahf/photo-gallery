import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { buckets, deleteObject } from '@/lib/s3';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { ids?: string[] };
  const ids = body.ids ?? [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
  }
  if (ids.length > 1000) {
    return NextResponse.json({ error: 'Too many ids (max 1000)' }, { status: 400 });
  }

  // Only photos that belong to galleries owned by the requester pass the filter.
  const owned = await db
    .select({
      id: photos.id,
      galleryId: photos.galleryId,
      s3KeyOriginal: photos.s3KeyOriginal,
      s3KeyWeb: photos.s3KeyWeb,
      s3KeyThumb: photos.s3KeyThumb,
      coverPhotoId: galleries.coverPhotoId,
    })
    .from(photos)
    .innerJoin(galleries, eq(galleries.id, photos.galleryId))
    .where(and(inArray(photos.id, ids), eq(galleries.userId, session.user.id)));

  if (owned.length === 0) {
    return NextResponse.json({ error: 'Nothing to delete' }, { status: 404 });
  }

  // Clear cover_photo_id for any galleries whose cover is in the delete set.
  const galleriesToUnsetCover = owned
    .filter((p) => p.coverPhotoId === p.id)
    .map((p) => p.galleryId);
  if (galleriesToUnsetCover.length > 0) {
    await db
      .update(galleries)
      .set({ coverPhotoId: sql`NULL` })
      .where(inArray(galleries.id, galleriesToUnsetCover));
  }

  const ownedIds = owned.map((p) => p.id);
  await db.delete(photos).where(inArray(photos.id, ownedIds));

  await Promise.allSettled(
    owned.flatMap((p) => [
      deleteObject(buckets.originals, p.s3KeyOriginal),
      deleteObject(buckets.photos, p.s3KeyWeb),
      deleteObject(buckets.photos, p.s3KeyThumb),
    ])
  );

  return NextResponse.json({ ok: true, deleted: owned.length });
}
