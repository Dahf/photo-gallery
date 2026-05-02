import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { publicPhotoUrl } from '@/lib/s3';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await db
    .select({
      id: galleries.id,
      slug: galleries.slug,
      title: galleries.title,
      createdAt: galleries.createdAt,
      photoCount: sql<number>`count(${photos.id})::int`,
      coverThumbKey: sql<string | null>`max(${photos.s3KeyThumb})`,
    })
    .from(galleries)
    .leftJoin(photos, eq(photos.galleryId, galleries.id))
    .where(eq(galleries.userId, userId))
    .groupBy(galleries.id)
    .orderBy(desc(galleries.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Galleries</h1>
        <Link
          href="/dashboard/galleries/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New gallery
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-neutral-500">No galleries yet. Create your first one.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <li
              key={g.id}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:shadow-md"
            >
              <Link href={`/dashboard/galleries/${g.id}`} className="block">
                <div className="aspect-[4/3] bg-neutral-100">
                  {g.coverThumbKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicPhotoUrl(g.coverThumbKey)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-400">
                      No photos yet
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-medium">{g.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{g.photoCount} photos</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
