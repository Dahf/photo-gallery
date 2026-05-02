'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

export type GalleryItem = {
  id: string;
  width: number;
  height: number;
  thumbUrl: string;
  webUrl: string;
  filename: string;
  isFavorite: boolean;
  plate: number;
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
  const [stamping, setStamping] = useState<string | null>(null);

  const close = useCallback(() => setActiveIdx(null), []);
  const next = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length]
  );
  const prev = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length]
  );

  const total = useMemo(() => String(items.length).padStart(3, '0'), [items.length]);

  async function toggleFavorite(photoId: string) {
    const isFav = favorites.has(photoId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(photoId);
      else {
        next.add(photoId);
        setStamping(photoId);
        setTimeout(() => setStamping((s) => (s === photoId ? null : s)), 420);
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

  return (
    <>
      {/* Asymmetric plate grid: every photo's column span is derived from its
          aspect ratio + plate number to break monotony without losing rhythm. */}
      <ul className="grid grid-cols-6 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-14 md:grid-cols-12">
        {items.map((item, idx) => {
          const isFav = favorites.has(item.id);
          const layout = layoutFor(item, idx);
          return (
            <li
              key={item.id}
              className={`${layout.col} group relative`}
              style={{ '--ar': `${item.width} / ${item.height}` } as React.CSSProperties}
            >
              {/* Plate number marginalia */}
              <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
                <span>
                  Plate <span className="text-ink">{String(item.plate).padStart(3, '0')}</span> / {total}
                </span>
                {isFav && <span className="text-seal">⁕ favoured</span>}
              </div>

              <button
                onClick={() => setActiveIdx(idx)}
                className="block w-full overflow-hidden plate-frame"
                aria-label={`Open plate ${item.plate}`}
              >
                <div
                  className="relative w-full overflow-hidden bg-cream"
                  style={{ aspectRatio: layout.forceAspect ?? `${item.width} / ${item.height}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.03]"
                  />
                  {/* Subtle dark vignette on hover */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                       style={{ background: 'radial-gradient(120% 120% at 50% 100%, rgba(21,17,13,0.25), transparent 60%)' }} />
                </div>
              </button>

              {favoritesEnabled && (
                <button
                  onClick={() => toggleFavorite(item.id)}
                  aria-label={isFav ? 'Remove favourite' : 'Mark as favourite'}
                  className={`absolute right-3 top-9 z-10 flex h-9 w-9 items-center justify-center transition ${
                    isFav
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  <WaxSeal active={isFav} stamping={stamping === item.id} />
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
          className="fixed inset-0 z-50 flex flex-col bg-ink"
          style={{ backgroundColor: '#0a0805' }}
          onClick={close}
        >
          {/* top chrome */}
          <div
            className="flex items-center justify-between px-6 py-5 sm:px-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
              Plate <span className="text-bone">{String(active.plate).padStart(3, '0')}</span> / {total}
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70 hover:text-bone"
            >
              Close ✕
            </button>
          </div>

          {/* image stage */}
          <div className="relative flex flex-1 items-center justify-center px-6 pb-6 sm:px-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 px-3 py-6 font-display text-4xl text-bone/40 transition hover:text-bone sm:left-6 sm:text-5xl"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-6 font-display text-4xl text-bone/40 transition hover:text-bone sm:right-6 sm:text-5xl"
              aria-label="Next"
            >
              ›
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.webUrl}
              alt={active.filename}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[78vh] max-w-[88vw] object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
            />
          </div>

          {/* bottom chrome */}
          <div
            className="flex items-center justify-between gap-6 px-6 pb-8 pt-4 sm:px-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/50">
              {active.filename}
            </div>
            <div className="flex items-center gap-2">
              {favoritesEnabled && (
                <button
                  onClick={() => toggleFavorite(active.id)}
                  className="flex h-9 items-center gap-2 border border-bone/20 bg-transparent px-3 text-[10px] uppercase tracking-[0.22em] text-bone/80 transition hover:border-bone/60 hover:text-bone"
                  aria-label="Toggle favourite"
                >
                  <WaxSeal active={favorites.has(active.id)} stamping={stamping === active.id} small />
                  <span>{favorites.has(active.id) ? 'Favoured' : 'Favour'}</span>
                </button>
              )}
              {downloadEnabled && (
                <a
                  href={`/api/g/${slug}/download/${active.id}`}
                  className="flex h-9 items-center border border-bone/20 px-4 text-[10px] uppercase tracking-[0.22em] text-bone/80 transition hover:border-bone/60 hover:text-bone"
                >
                  Download original ↓
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Layout choice — gives variety across the grid.
// Pattern repeats every 9 plates for a magazine-like rhythm.
function layoutFor(item: GalleryItem, idx: number): { col: string; forceAspect?: string } {
  const isLandscape = item.width >= item.height;
  const slot = idx % 9;
  // Hero: full wide landscape every 9th slot
  if (slot === 0 && idx > 0) {
    return {
      col: 'col-span-6 md:col-span-12',
      forceAspect: isLandscape ? '16 / 9' : undefined,
    };
  }
  // Diptych: two large side-by-side
  if (slot === 3 || slot === 4) {
    return { col: 'col-span-6 md:col-span-6' };
  }
  // Tall portrait centerpiece
  if (slot === 6 && !isLandscape) {
    return { col: 'col-span-6 md:col-span-5 md:col-start-4' };
  }
  // Default: thirds — sized so a row of three feels generous
  return { col: 'col-span-3 md:col-span-4' };
}

function WaxSeal({
  active,
  stamping,
  small,
}: {
  active: boolean;
  stamping: boolean;
  small?: boolean;
}) {
  const size = small ? 16 : 22;
  if (!active) {
    return (
      <span
        className="flex items-center justify-center rounded-full border border-ink/30 bg-bone/85 backdrop-blur-sm"
        style={{ width: size + 14, height: size + 14 }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M8 12h8M12 8v8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full text-bone shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_2px_8px_rgba(159,43,31,0.45)] ${stamping ? 'seal-stamp' : ''}`}
      style={{
        width: size + 14,
        height: size + 14,
        background:
          'radial-gradient(120% 120% at 30% 25%, var(--seal-2) 0%, var(--seal) 55%, #6e1b13 100%)',
      }}
    >
      <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21s-7.5-4.7-9.7-9.5C.7 7.6 3.4 4 7 4c2 0 3.6 1.1 5 2.8C13.4 5.1 15 4 17 4c3.6 0 6.3 3.6 4.7 7.5C19.5 16.3 12 21 12 21z" />
      </svg>
    </span>
  );
}
