import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, deleteObject } from '@/lib/s3';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      userId: galleries.userId,
      heroVideoKey: galleries.heroVideoKey,
      heroVideoOriginalKey: galleries.heroVideoOriginalKey,
    })
    .from(galleries)
    .where(eq(galleries.id, id))
    .limit(1);

  if (!gallery) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (gallery.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const photoRows = await db
    .select({
      s3KeyOriginal: photos.s3KeyOriginal,
      s3KeyWeb: photos.s3KeyWeb,
      s3KeyThumb: photos.s3KeyThumb,
    })
    .from(photos)
    .where(eq(photos.galleryId, gallery.id));

  // DB cascade removes photos + favorites rows.
  await db.delete(galleries).where(and(eq(galleries.id, gallery.id), eq(galleries.userId, session.user.id)));

  // Best-effort S3 cleanup. Failures don't undo the DB delete.
  await Promise.allSettled([
    ...photoRows.flatMap((p) => [
      deleteObject(buckets.originals, p.s3KeyOriginal),
      deleteObject(buckets.photos, p.s3KeyWeb),
      deleteObject(buckets.photos, p.s3KeyThumb),
    ]),
    ...(gallery.heroVideoKey ? [deleteObject(buckets.originals, gallery.heroVideoKey)] : []),
    ...(gallery.heroVideoOriginalKey
      ? [deleteObject(buckets.originals, gallery.heroVideoOriginalKey)]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
