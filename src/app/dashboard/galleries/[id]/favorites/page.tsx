import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos, favorites } from '@/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { FavoritesView, type CullPhoto } from './favorites-view';

export default async function GalleryFavoritesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [gallery] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) notFound();

  // All photos with their favourite count (LEFT JOIN so non-favourites appear too).
  const rows = await db
    .select({
      id: photos.id,
      filename: photos.filename,
      favoriteCount: sql<number>`count(${favorites.id})::int`,
    })
    .from(photos)
    .leftJoin(favorites, eq(favorites.photoId, photos.id))
    .where(eq(photos.galleryId, gallery.id))
    .groupBy(photos.id, photos.filename, photos.sortOrder, photos.createdAt)
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const cullPhotos: CullPhoto[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    isFavorite: r.favoriteCount > 0,
    favoriteCount: r.favoriteCount,
  }));

  const favCount = cullPhotos.filter((p) => p.isFavorite).length;

  return (
    <div className="space-y-8">
      <Link
        href={`/dashboard/galleries/${gallery.id}`}
        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-text"
      >
        ← Back to gallery
      </Link>

      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="h-px w-8 bg-accent" />
          <span>Cull view</span>
        </div>
        <h1 className="display mt-4 text-4xl text-text sm:text-5xl">{gallery.title}</h1>
        <p className="mt-3 tabular text-sm text-muted">
          {String(favCount).padStart(3, '0')} chosen of {String(cullPhotos.length).padStart(3, '0')} total
        </p>
      </div>

      <FavoritesView photos={cullPhotos} gallerySlug={gallery.slug} />
    </div>
  );
}
