import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos, favorites } from '@/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { photoUrl } from '@/lib/s3';
import Link from 'next/link';

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

  const rows = await db
    .select({
      photoId: photos.id,
      filename: photos.filename,
      favoriteCount: sql<number>`count(${favorites.id})::int`,
    })
    .from(favorites)
    .innerJoin(photos, eq(photos.id, favorites.photoId))
    .where(eq(favorites.galleryId, gallery.id))
    .groupBy(photos.id, photos.filename)
    .orderBy(asc(photos.sortOrder));

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
          <span>Client favourites</span>
        </div>
        <h1 className="display mt-4 text-4xl text-text sm:text-5xl">{gallery.title}</h1>
        <p className="mt-3 tabular text-sm text-muted">
          {String(rows.length).padStart(3, '0')} {rows.length === 1 ? 'photo' : 'photos'} marked as favourite
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-line py-24 text-center">
          <p className="display text-2xl text-muted">No favourites yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {rows.map((r) => (
            <li key={r.photoId} className="space-y-2">
              <div className="cell aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(gallery.slug, r.photoId, 'thumb')} alt={r.filename} className="h-full w-full object-cover" />
                <span className="fav-clip" />
                <span className="fav-dot" />
                {r.favoriteCount > 1 && (
                  <div className="absolute bottom-1 right-1 tabular bg-accent px-1.5 py-0.5 text-[10px] font-bold text-bg">
                    ×{r.favoriteCount}
                  </div>
                )}
              </div>
              <div className="truncate text-[11px] text-dim" title={r.filename}>
                {r.filename}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
