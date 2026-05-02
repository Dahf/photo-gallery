import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries, photos, favorites } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';

async function loadGallery(slug: string) {
  const [g] = await db
    .select({ id: galleries.id, passwordHash: galleries.passwordHash, favoritesEnabled: galleries.favoritesEnabled })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);
  return g ?? null;
}

async function authorize(slug: string) {
  const g = await loadGallery(slug);
  if (!g) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!g.favoritesEnabled) return { error: NextResponse.json({ error: 'Favorites disabled' }, { status: 403 }) };
  if (!(await hasGalleryAccess(slug, g.passwordHash))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { gallery: g };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await authorize(slug);
  if ('error' in auth) return auth.error;

  const { photoId } = (await req.json()) as { photoId?: string };
  if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 });

  const [photo] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, auth.gallery.id)))
    .limit(1);
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const sessionId = await getOrSetClientSession();
  await db
    .insert(favorites)
    .values({ galleryId: auth.gallery.id, photoId, clientSessionId: sessionId })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const auth = await authorize(slug);
  if ('error' in auth) return auth.error;

  const { photoId } = (await req.json()) as { photoId?: string };
  if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 });

  const sessionId = await getOrSetClientSession();
  await db
    .delete(favorites)
    .where(and(eq(favorites.photoId, photoId), eq(favorites.clientSessionId, sessionId)));
  return NextResponse.json({ ok: true });
}
