import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, completeMultipartUpload, deleteObject } from '@/lib/s3';

type PartIn = { partNumber: number; etag: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as {
    key?: string;
    uploadId?: string;
    parts?: PartIn[];
    mime?: string;
    sizeBytes?: number;
  };

  if (!body.key || !body.uploadId || !body.parts?.length || !body.mime) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const galleryId = body.key.split('/')[0];
  const [gallery] = await db
    .select({ id: galleries.id, oldKey: galleries.heroVideoKey })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id), eq(galleries.id, galleryId)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  const sortedParts = [...body.parts].sort((a, b) => a.partNumber - b.partNumber);
  await completeMultipartUpload(
    buckets.originals,
    body.key,
    body.uploadId,
    sortedParts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
  );

  await db
    .update(galleries)
    .set({
      heroVideoKey: body.key,
      heroVideoMime: body.mime,
      heroVideoSizeBytes: body.sizeBytes ?? null,
    })
    .where(eq(galleries.id, gallery.id));

  if (gallery.oldKey && gallery.oldKey !== body.key) {
    deleteObject(buckets.originals, gallery.oldKey).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
