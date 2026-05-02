import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { presignPut, buckets } from '@/lib/s3';
import { nanoid } from 'nanoid';

const ALLOWED_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as { contentType?: string; filename?: string };
  const contentType = body.contentType ?? '';
  const filename = body.filename ?? 'video';

  if (!ALLOWED_MIMES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported video type: ${contentType}. Use mp4, mov, or webm.` },
      { status: 400 }
    );
  }

  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.mp4';
  const key = `${gallery.id}/hero_${nanoid(12)}${ext}`;
  const uploadUrl = await presignPut(buckets.originals, key, contentType, 1800); // 30 min for big files
  return NextResponse.json({ uploadUrl, key });
}
