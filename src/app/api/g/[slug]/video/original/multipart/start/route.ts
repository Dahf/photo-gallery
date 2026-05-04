import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, createMultipartUpload } from '@/lib/s3';
import { nanoid } from 'nanoid';

// Originals are download-only; browsers don't have to play them, so any video container or
// generic octet-stream (ProRes/MXF/MKV) is allowed.
function isAllowedOriginalMime(mime: string): boolean {
  if (mime === 'application/octet-stream') return true;
  return mime.startsWith('video/');
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as { contentType?: string; filename?: string };
  const contentType = body.contentType ?? '';
  const filename = body.filename ?? 'video';

  if (!isAllowedOriginalMime(contentType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${contentType}.` },
      { status: 400 }
    );
  }

  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const key = `${gallery.id}/hero_original_${nanoid(12)}${ext}`;

  const uploadId = await createMultipartUpload(buckets.originals, key, contentType);
  return NextResponse.json({ uploadId, key });
}
