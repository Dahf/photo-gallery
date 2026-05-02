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
      createdAt: galleries.createdAt,
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

  const items = photoList.map((p, idx) => ({
    id: p.id,
    width: p.width,
    height: p.height,
    thumbUrl: publicPhotoUrl(p.s3KeyThumb),
    webUrl: publicPhotoUrl(p.s3KeyWeb),
    filename: p.filename,
    isFavorite: favoriteIds.has(p.id),
    plate: idx + 1,
  }));

  const dateLabel = gallery.createdAt.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const totalLabel = String(items.length).padStart(3, '0');

  return (
    <div
      className="relative min-h-screen"
      style={{ '--accent': gallery.brandColor ?? 'var(--seal)' } as React.CSSProperties}
    >
      {/* Marginalia header */}
      <header className="px-6 pt-8 sm:px-12 sm:pt-10">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <span>{gallery.studioName ?? 'Snapshare'} ⁕ Atelier</span>
          <span className="hidden md:inline">{dateLabel}</span>
          <span>
            <span className="text-ink">{totalLabel}</span> plates
          </span>
        </div>
        <div className="rule mt-4" />
      </header>

      {/* Editorial title block — overlaps the first photo on desktop */}
      <section className="relative px-6 pb-10 pt-14 sm:px-12 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-28">
        <div className="grid grid-cols-12 gap-x-6">
          <div className="col-span-12 lg:col-span-9">
            <p className="rise font-mono text-[11px] uppercase tracking-[0.28em] text-stone">
              Vol. I — {dateLabel}
            </p>
            <h1 className="rise rise-delay-1 font-display font-display-tight mt-6 text-[clamp(2.75rem,9vw,9rem)] leading-[0.86] text-ink">
              {renderTitle(gallery.title)}
            </h1>
            {gallery.description && (
              <p className="rise rise-delay-2 mt-8 max-w-xl text-lg leading-relaxed text-char">
                {gallery.description}
              </p>
            )}
          </div>
          <div className="col-span-12 mt-10 flex items-end justify-between gap-6 lg:col-span-3 lg:mt-0 lg:justify-end">
            {gallery.downloadEnabled && items.length > 0 && (
              <a
                href={`/api/g/${gallery.slug}/download`}
                className="rise rise-delay-3 group inline-flex items-center gap-3 border border-ink bg-bone px-5 py-3.5 text-xs uppercase tracking-[0.2em] text-ink transition hover:bg-ink hover:text-bone"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v13M5 11l7 7 7-7M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Download binder</span>
              </a>
            )}
          </div>
        </div>

        {/* Decorative colophon */}
        <div className="rise rise-delay-4 mt-14 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.22em] text-stone sm:mt-20">
          <span>§ Press F to favourite</span>
          <span className="hidden sm:inline">↔ Arrow keys to navigate</span>
          <span className="hidden sm:inline">Esc to close</span>
        </div>
      </section>

      {/* Plate grid */}
      <section className="px-6 pb-24 sm:px-12 sm:pb-32">
        {items.length === 0 ? (
          <div className="border-y border-ink/15 py-32 text-center">
            <p className="font-display text-3xl italic text-stone">No plates pressed yet.</p>
          </div>
        ) : (
          <GalleryView
            items={items}
            slug={gallery.slug}
            downloadEnabled={gallery.downloadEnabled}
            favoritesEnabled={gallery.favoritesEnabled}
          />
        )}
      </section>

      <footer className="border-t border-ink/15 px-6 pb-10 pt-6 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <span>{gallery.studioName ?? 'Snapshare'}</span>
          <span>End of volume — {totalLabel} plates</span>
        </div>
      </footer>
    </div>
  );
}

// Render the last word of the title in italic for editorial drama.
function renderTitle(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length === 1) return <em className="font-normal italic">{words[0]}</em>;
  const head = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];
  return (
    <>
      {head}
      <br />
      <em className="font-normal italic text-seal">{tail}</em>
    </>
  );
}
