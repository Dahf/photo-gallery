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

  const close = useCallback(() => setActiveIdx(null), []);
  const next = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length]
  );
  const prev = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'f' && favoritesEnabled) toggleFavorite(items[activeIdx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, close, next, prev, favoritesEnabled, items]);

  async function toggleFavorite(photoId: string) {
    const isFav = favorites.has(photoId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
    try {
      await fetch(`/api/g/${slug}/favorite`, {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });
    } catch {
      // revert on failure
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(photoId);
        else next.delete(photoId);
        return next;
      });
    }
  }

  const active = activeIdx === null ? null : items[activeIdx];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item, idx) => {
          const isFav = favorites.has(item.id);
          return (
            <li key={item.id} className="group relative aspect-square overflow-hidden rounded-md bg-neutral-100">
              <button
                onClick={() => setActiveIdx(idx)}
                className="block h-full w-full"
                aria-label={`View ${item.filename}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
              {favoritesEnabled && (
                <button
                  onClick={() => toggleFavorite(item.id)}
                  aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                  className={`absolute right-2 top-2 rounded-full p-1.5 backdrop-blur transition ${
                    isFav ? 'bg-red-500 text-white' : 'bg-white/80 text-neutral-700 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <HeartIcon filled={isFav} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={close}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Next"
          >
            ›
          </button>
          <button
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.webUrl}
            alt={active.filename}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur"
          >
            <span>
              {activeIdx! + 1} / {items.length}
            </span>
            {favoritesEnabled && (
              <button
                onClick={() => toggleFavorite(active.id)}
                className={`rounded-full p-1.5 transition ${
                  favorites.has(active.id) ? 'bg-red-500' : 'hover:bg-white/20'
                }`}
                aria-label="Toggle favorite"
              >
                <HeartIcon filled={favorites.has(active.id)} />
              </button>
            )}
            {downloadEnabled && (
              <a
                href={`/api/g/${slug}/download/${active.id}`}
                className="rounded-full px-3 py-1 hover:bg-white/20"
              >
                Download
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
