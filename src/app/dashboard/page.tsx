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
    <div className="space-y-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-stone">
            Vol. — Working volumes
          </p>
          <h1 className="mt-3 font-display font-display-tight text-6xl leading-[0.9] text-ink sm:text-7xl">
            Your <em className="font-normal italic text-seal">galleries</em>.
          </h1>
        </div>
        <Link
          href="/dashboard/galleries/new"
          className="group inline-flex items-center gap-3 bg-ink px-5 py-3.5 text-xs uppercase tracking-[0.24em] text-bone transition hover:bg-seal"
        >
          <span>New gallery</span>
          <span className="font-mono transition group-hover:translate-x-1">+</span>
        </Link>
      </div>
      <div className="rule" />

      {rows.length === 0 ? (
        <div className="border border-ink/15 px-8 py-24 text-center">
          <p className="font-display text-4xl italic text-stone">No volumes yet.</p>
          <p className="mt-3 text-sm text-char">Press a new gallery and begin a binder.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g, i) => (
            <li key={g.id}>
              <Link href={`/dashboard/galleries/${g.id}`} className="group block">
                <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
                  <span>
                    Vol. <span className="text-ink">{String(i + 1).padStart(3, '0')}</span>
                  </span>
                  <span>{g.photoCount} plates</span>
                </div>
                <div className="aspect-[4/5] overflow-hidden plate-frame">
                  {g.coverThumbKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicPhotoUrl(g.coverThumbKey)}
                      alt=""
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-cream font-display text-2xl italic text-stone">
                      empty
                    </div>
                  )}
                </div>
                <h2 className="mt-4 font-display text-3xl leading-tight text-ink group-hover:text-seal transition">
                  {g.title}
                </h2>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
                  {g.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
