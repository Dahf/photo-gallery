import { db } from '@/lib/db';
import { galleries, photos, favorites, users } from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { publicPhotoUrl } from '@/lib/s3';
import { GalleryView } from './gallery-view';

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      title: galleries.title,
      description: galleries.description,
      passwordHash: galleries.passwordHash,
      downloadEnabled: galleries.downloadEnabled,
      favoritesEnabled: galleries.favoritesEnabled,
      expiresAt: galleries.expiresAt,
      studioName: users.studioName,
      brandColor: users.brandColor,
      logoUrl: users.logoUrl,
    })
    .from(galleries)
    .innerJoin(users, eq(users.id, galleries.userId))
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery) notFound();
  if (gallery.expiresAt && gallery.expiresAt < new Date()) notFound();

  const allowed = await hasGalleryAccess(slug, gallery.passwordHash);
  if (!allowed) redirect(`/g/${slug}/password`);

  const photoList = await db
    .select()
    .from(photos)
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const sessionId = await getOrSetClientSession();
  const favRows = photoList.length
    ? await db
        .select({ photoId: favorites.photoId })
        .from(favorites)
        .where(
          and(
            eq(favorites.clientSessionId, sessionId),
            inArray(
              favorites.photoId,
              photoList.map((p) => p.id)
            )
          )
        )
    : [];
  const favoriteIds = new Set(favRows.map((r) => r.photoId));

  const items = photoList.map((p) => ({
    id: p.id,
    width: p.width,
    height: p.height,
    thumbUrl: publicPhotoUrl(p.s3KeyThumb),
    webUrl: publicPhotoUrl(p.s3KeyWeb),
    filename: p.filename,
    isFavorite: favoriteIds.has(p.id),
  }));

  return (
    <div className="min-h-screen bg-white" style={{ '--brand': gallery.brandColor ?? '#111111' } as React.CSSProperties}>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            {gallery.studioName && (
              <div className="text-xs uppercase tracking-widest text-neutral-500">{gallery.studioName}</div>
            )}
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{gallery.title}</h1>
            {gallery.description && (
              <p className="mt-1 text-sm text-neutral-500">{gallery.description}</p>
            )}
          </div>
          {gallery.downloadEnabled && photoList.length > 0 && (
            <a
              href={`/api/g/${gallery.slug}/download`}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Download all
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {items.length === 0 ? (
          <p className="py-20 text-center text-neutral-500">This gallery is empty.</p>
        ) : (
          <GalleryView
            items={items}
            slug={gallery.slug}
            downloadEnabled={gallery.downloadEnabled}
            favoritesEnabled={gallery.favoritesEnabled}
          />
        )}
      </main>
    </div>
  );
}
