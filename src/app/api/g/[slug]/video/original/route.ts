import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { buckets, deleteObject } from '@/lib/s3';

export const runtime = 'nodejs';

// Admin-only: remove the original (download-only) hero video.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await ctx.params;
  const [gallery] = await db
    .select({ id: galleries.id, key: galleries.heroVideoOriginalKey })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (gallery.key) {
    await deleteObject(buckets.originals, gallery.key).catch(() => {});
  }
  await db
    .update(galleries)
    .set({
      heroVideoOriginalKey: null,
      heroVideoOriginalMime: null,
      heroVideoOriginalSizeBytes: null,
    })
    .where(eq(galleries.id, gallery.id));

  return NextResponse.json({ ok: true });
}
