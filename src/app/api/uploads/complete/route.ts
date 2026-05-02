import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, getObjectBuffer, putObject } from '@/lib/s3';
import { processImage } from '@/lib/images';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    galleryId?: string;
    key?: string;
    filename?: string;
    sizeBytes?: number;
  };
  const { galleryId, key, filename, sizeBytes } = body;
  if (!galleryId || !key || !filename) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  try {
    const original = await getObjectBuffer(buckets.originals, key);
    const processed = await processImage(original);

    const baseKey = key.replace(/\.[^.]+$/, '');
    const webKey = `${baseKey}_web.jpg`;
    const thumbKey = `${baseKey}_thumb.jpg`;

    await Promise.all([
      putObject(buckets.photos, webKey, processed.web.buffer, 'image/jpeg'),
      putObject(buckets.photos, thumbKey, processed.thumb.buffer, 'image/jpeg'),
    ]);

    const [created] = await db
      .insert(photos)
      .values({
        galleryId,
        filename,
        s3KeyOriginal: key,
        s3KeyWeb: webKey,
        s3KeyThumb: thumbKey,
        width: processed.original.width,
        height: processed.original.height,
        sizeBytes: sizeBytes ?? original.length,
      })
      .returning({ id: photos.id });

    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error('Upload complete failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
