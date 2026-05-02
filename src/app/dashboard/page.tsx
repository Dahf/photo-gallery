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
      passwordHash: galleries.passwordHash,
      photoCount: sql<number>`count(${photos.id})::int`,
      coverThumbKey: sql<string | null>`max(${photos.s3KeyThumb})`,
    })
    .from(galleries)
    .leftJoin(photos, eq(photos.galleryId, galleries.id))
    .where(eq(galleries.userId, userId))
    .groupBy(galleries.id)
    .orderBy(desc(galleries.createdAt));

  const totalPhotos = rows.reduce((acc, g) => acc + g.photoCount, 0);

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-8 bg-accent" />
            <span>Studio</span>
          </div>
          <h1 className="display mt-4 text-5xl text-text sm:text-6xl">Galleries</h1>
        </div>
        <Link href="/dashboard/galleries/new" className="btn-primary">
          New gallery
          <span aria-hidden>+</span>
        </Link>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-px border border-line bg-line">
        <Stat n={String(rows.length).padStart(2, '0')} label="Galleries" />
        <Stat n={String(totalPhotos).padStart(3, '0')} label="Photos" />
        <Stat
          n={String(rows.filter((r) => r.passwordHash).length).padStart(2, '0')}
          label="Sealed"
        />
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-line py-24 text-center">
          <p className="display text-3xl text-muted">No galleries yet.</p>
          <p className="mt-3 text-sm text-dim">Press the button above to create your first.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g, i) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/galleries/${g.id}`}
                className="group block border border-line bg-surface transition hover:border-accent"
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-surface-2">
                  {g.coverThumbKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicPhotoUrl(g.coverThumbKey)}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-dim">
                      <span className="display text-2xl">empty</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 tabular bg-bg/85 px-2 py-1 text-[11px] font-semibold text-text">
                    #{String(i + 1).padStart(2, '0')}
                  </div>
                  {g.passwordHash && (
                    <div className="absolute right-3 top-3 bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-bg">
                      Sealed
                    </div>
                  )}
                </div>
                <div className="border-t border-line p-4">
                  <h2 className="truncate text-base font-semibold text-text group-hover:text-accent">
                    {g.title}
                  </h2>
                  <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-dim">
                    <span className="tabular">{String(g.photoCount).padStart(3, '0')} photos</span>
                    <span className="tabular">
                      {g.createdAt
                        .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        .replace(/\//g, '.')}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 bg-bg p-5">
      <div className="display tabular text-3xl text-text">{n}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{label}</div>
    </div>
  );
}
