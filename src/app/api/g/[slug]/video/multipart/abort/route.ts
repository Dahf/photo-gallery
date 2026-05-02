import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, abortMultipartUpload } from '@/lib/s3';

// Best-effort cleanup of an in-progress multipart upload (browser cancelled, network died, etc).
// Without this, S3/MinIO accumulates orphaned parts that count against storage.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as { key?: string; uploadId?: string };
  if (!body.key || !body.uploadId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const galleryId = body.key.split('/')[0];
  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id), eq(galleries.id, galleryId)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  await abortMultipartUpload(buckets.originals, body.key, body.uploadId).catch(() => {});
  return NextResponse.json({ ok: true });
}
