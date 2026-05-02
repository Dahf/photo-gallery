import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buckets, deleteObject } from '@/lib/s3';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json()) as { key?: string; mime?: string; sizeBytes?: number };
  if (!body.key || !body.mime) {
    return NextResponse.json({ error: 'Missing key or mime' }, { status: 400 });
  }

  const [gallery] = await db
    .select({ id: galleries.id, oldKey: galleries.heroVideoKey })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  await db
    .update(galleries)
    .set({
      heroVideoKey: body.key,
      heroVideoMime: body.mime,
      heroVideoSizeBytes: body.sizeBytes ?? null,
    })
    .where(eq(galleries.id, gallery.id));

  // Best-effort cleanup of any previous hero video
  if (gallery.oldKey && gallery.oldKey !== body.key) {
    deleteObject(buckets.originals, gallery.oldKey).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
