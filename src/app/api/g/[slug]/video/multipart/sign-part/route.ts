import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, presignUploadPart } from '@/lib/s3';

// Returns a presigned PUT URL for a single part of an in-progress multipart upload.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as {
    key?: string;
    uploadId?: string;
    partNumber?: number;
  };

  if (!body.key || !body.uploadId || !body.partNumber || body.partNumber < 1 || body.partNumber > 10000) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Confirm the gallery is owned by the requesting user. Key is scoped by gallery id,
  // so we re-derive ownership from the prefix and refuse if it does not match.
  const galleryId = body.key.split('/')[0];
  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id), eq(galleries.id, galleryId)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  const url = await presignUploadPart(buckets.originals, body.key, body.uploadId, body.partNumber);
  return NextResponse.json({ url });
}
