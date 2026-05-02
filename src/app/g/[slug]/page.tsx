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
    index: idx + 1,
  }));

  const dateLabel = gallery.createdAt
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '.');

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Sticky top bar — pro-tool chrome */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-5 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-2.5 w-2.5 shrink-0 bg-accent" />
          <span className="truncate text-sm font-semibold tracking-tight">
            {gallery.studioName ?? 'Snapshot'}
          </span>
          <span className="hidden text-xs uppercase tracking-[0.12em] text-dim sm:inline">·</span>
          <span className="hidden truncate text-xs uppercase tracking-[0.12em] text-muted sm:inline">
            {gallery.title}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden tabular text-xs text-dim sm:inline">{dateLabel}</span>
          <span className="tabular text-xs font-semibold text-text">
            {String(items.length).padStart(3, '0')}
          </span>
          {gallery.downloadEnabled && items.length > 0 && (
            <a
              href={`/api/g/${gallery.slug}/download`}
              className="ml-2 inline-flex items-center gap-2 border border-line-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text transition hover:border-accent hover:text-accent"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v12M6 12l6 6 6-6M4 20h16" strokeLinecap="square" />
              </svg>
              <span className="hidden sm:inline">Download all</span>
              <span className="sm:hidden">.zip</span>
            </a>
          )}
        </div>
      </header>

      {/* Title block */}
      <section className="border-b border-line px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="fade-up flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            <span className="text-accent">/ Gallery</span>
            <span className="tabular text-dim">{dateLabel}</span>
            <span className="tabular text-dim">{String(items.length).padStart(3, '0')} photos</span>
            {gallery.passwordHash && <span className="text-dim">· Sealed</span>}
          </div>

          <h1 className="display fade-up fade-up-1 mt-6 text-[clamp(2.5rem,9vw,8rem)] text-text">
            {gallery.title}
          </h1>

          {gallery.description && (
            <p className="fade-up fade-up-2 mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {gallery.description}
            </p>
          )}

          <div className="fade-up fade-up-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-dim">
            <span><kbd className="border border-line-2 px-1.5 py-px text-[10px]">←</kbd> <kbd className="border border-line-2 px-1.5 py-px text-[10px]">→</kbd> Navigate</span>
            <span><kbd className="border border-line-2 px-1.5 py-px text-[10px]">F</kbd> Favourite</span>
            <span><kbd className="border border-line-2 px-1.5 py-px text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          {items.length === 0 ? (
            <div className="border border-dashed border-line py-32 text-center">
              <p className="display text-3xl text-muted">No photos yet.</p>
            </div>
          ) : (
            <GalleryView
              items={items}
              slug={gallery.slug}
              downloadEnabled={gallery.downloadEnabled}
              favoritesEnabled={gallery.favoritesEnabled}
            />
          )}
        </div>
      </section>

      <footer className="border-t border-line px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] uppercase tracking-[0.12em] text-dim">
          <span>{gallery.studioName ?? 'Snapshot'}</span>
          <span>End — {String(items.length).padStart(3, '0')} photos</span>
        </div>
      </footer>
    </div>
  );
}
