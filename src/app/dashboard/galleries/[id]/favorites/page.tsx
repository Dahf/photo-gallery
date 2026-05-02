import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos, favorites } from '@/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { publicPhotoUrl } from '@/lib/s3';
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
      thumbKey: photos.s3KeyThumb,
      favoriteCount: sql<number>`count(${favorites.id})::int`,
    })
    .from(favorites)
    .innerJoin(photos, eq(photos.id, favorites.photoId))
    .where(eq(favorites.galleryId, gallery.id))
    .groupBy(photos.id, photos.filename, photos.s3KeyThumb)
    .orderBy(asc(photos.sortOrder));

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/galleries/${gallery.id}`} className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to gallery
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Favorites — {gallery.title}</h1>
      <p className="text-sm text-neutral-500">
        {rows.length} {rows.length === 1 ? 'photo' : 'photos'} marked as favorite by clients.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
          No favorites yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((r) => (
            <li key={r.photoId} className="space-y-1">
              <div className="aspect-square overflow-hidden rounded-md bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicPhotoUrl(r.thumbKey)} alt={r.filename} className="h-full w-full object-cover" />
              </div>
              <div className="truncate text-xs text-neutral-500" title={r.filename}>
                {r.filename}
              </div>
              {r.favoriteCount > 1 && (
                <div className="text-xs text-red-600">★ {r.favoriteCount} clients</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
