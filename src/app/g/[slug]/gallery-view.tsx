'use client';

import { useEffect, useState, useCallback } from 'react';

export type GalleryItem = {
  id: string;
  width: number;
  height: number;
  thumbUrl: string;
  webUrl: string;
  filename: string;
  isFavorite: boolean;
  index: number;
};

export function GalleryView({
  items,
  slug,
  downloadEnabled,
  favoritesEnabled,
}: {
  items: GalleryItem[];
  slug: string;
  downloadEnabled: boolean;
  favoritesEnabled: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.isFavorite).map((i) => i.id))
  );
  const [pulsing, setPulsing] = useState<string | null>(null);

  const close = useCallback(() => setActiveIdx(null), []);
  const next = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length]
  );
  const prev = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length]
  );

  async function toggleFavorite(photoId: string) {
    const isFav = favorites.has(photoId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(photoId);
      else {
        next.add(photoId);
        setPulsing(photoId);
        setTimeout(() => setPulsing((s) => (s === photoId ? null : s)), 320);
      }
      return next;
    });
    try {
      await fetch(`/api/g/${slug}/favorite`, {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });
    } catch {
      setFavorites((prev) => {
        const n = new Set(prev);
        if (isFav) n.add(photoId);
        else n.delete(photoId);
        return n;
      });
    }
  }

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if ((e.key === 'f' || e.key === 'F') && favoritesEnabled) {
        toggleFavorite(items[activeIdx].id);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, close, next, prev, favoritesEnabled, items]);

  const active = activeIdx === null ? null : items[activeIdx];
  const total = String(items.length).padStart(3, '0');

  return (
    <>
      {/* Dense uniform grid — pro contact-sheet rhythm */}
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item, idx) => {
          const isFav = favorites.has(item.id);
          return (
            <li key={item.id} className="cell aspect-square group">
              <button
                onClick={() => setActiveIdx(idx)}
                className="block h-full w-full"
                aria-label={`Open photo ${item.index}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-hover:opacity-90"
                />
              </button>

              {/* index pill — appears on hover */}
              <div className="pointer-events-none absolute bottom-2 right-2 tabular bg-bg/85 px-1.5 py-0.5 text-[10px] font-semibold text-text opacity-0 transition group-hover:opacity-100">
                {String(item.index).padStart(3, '0')}
              </div>

              {/* favourite chartreuse corner clip */}
              {isFav && (
                <>
                  <span className={`fav-clip ${pulsing === item.id ? 'accent-flash' : ''}`} />
                  <span className="fav-dot" />
                </>
              )}

              {favoritesEnabled && (
                <button
                  onClick={() => toggleFavorite(item.id)}
                  aria-label={isFav ? 'Remove favourite' : 'Mark favourite'}
                  className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center border transition ${
                    isFav
                      ? 'border-accent bg-accent text-bg opacity-100'
                      : 'border-line-2 bg-bg/80 text-text opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star filled={isFav} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Lightbox */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          onClick={close}
        >
          {/* Top strip */}
          <div
            className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 bg-accent" />
              <span className="tabular text-sm font-semibold">
                {String(active.index).padStart(3, '0')}
                <span className="text-dim"> / {total}</span>
              </span>
              <span className="hidden text-xs uppercase tracking-[0.12em] text-dim sm:inline">
                {active.filename}
              </span>
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:text-text"
            >
              Close [esc]
            </button>
          </div>

          {/* Stage */}
          <div
            className="relative flex flex-1 items-center justify-center px-4 py-4 sm:px-12"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center text-2xl text-muted transition hover:text-accent sm:left-6"
            >
              ←
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center text-2xl text-muted transition hover:text-accent sm:right-6"
            >
              →
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.webUrl}
              alt={active.filename}
              className="max-h-[78vh] max-w-[90vw] object-contain"
            />
          </div>

          {/* Bottom action strip — film-strip index */}
          <div
            className="border-t border-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
              <div className="flex items-center gap-2">
                {favoritesEnabled && (
                  <button
                    onClick={() => toggleFavorite(active.id)}
                    aria-label="Toggle favourite"
                    className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                      favorites.has(active.id)
                        ? 'border-accent bg-accent text-bg'
                        : 'border-line-2 text-text hover:border-accent hover:text-accent'
                    }`}
                  >
                    <Star filled={favorites.has(active.id)} />
                    <span>{favorites.has(active.id) ? 'Favoured' : 'Favour'}</span>
                  </button>
                )}
                {downloadEnabled && (
                  <a
                    href={`/api/g/${slug}/download/${active.id}`}
                    className="inline-flex items-center gap-2 border border-line-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text transition hover:border-accent hover:text-accent"
                  >
                    <span>Download original</span>
                    <span aria-hidden>↓</span>
                  </a>
                )}
              </div>
              <div className="hidden text-[11px] uppercase tracking-[0.12em] text-dim sm:block">
                <kbd className="border border-line-2 px-1.5 py-px text-[10px]">←</kbd> prev ·
                <kbd className="ml-2 border border-line-2 px-1.5 py-px text-[10px]">→</kbd> next ·
                <kbd className="ml-2 border border-line-2 px-1.5 py-px text-[10px]">F</kbd> favour
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M12 3l2.7 6 6.3.5-4.8 4.2 1.5 6.3L12 16.8 6.3 20l1.5-6.3L3 9.5 9.3 9 12 3z" />
    </svg>
  );
}
