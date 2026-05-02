'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type CullPhoto = {
  id: string;
  filename: string;
  isFavorite: boolean;
  favoriteCount: number;
};

type Filter = 'all' | 'favorites' | 'unculled';

export function FavoritesView({
  photos,
  gallerySlug,
}: {
  photos: CullPhoto[];
  gallerySlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<null | 'selected' | 'all-unculled'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favorites = useMemo(() => photos.filter((p) => p.isFavorite), [photos]);
  const unculled = useMemo(() => photos.filter((p) => !p.isFavorite), [photos]);

  const visible = filter === 'favorites' ? favorites : filter === 'unculled' ? unculled : photos;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkDelete(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/photos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? res.statusText);
        return;
      }
      clearSelection();
      setConfirming(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <div className="flex gap-px bg-line">
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={photos.length}
          />
          <FilterTab
            active={filter === 'favorites'}
            onClick={() => setFilter('favorites')}
            label="Favourites"
            count={favorites.length}
            accent
          />
          <FilterTab
            active={filter === 'unculled'}
            onClick={() => setFilter('unculled')}
            label="Not chosen"
            count={unculled.length}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
                {selected.size} selected
              </span>
              <button type="button" onClick={clearSelection} className="btn-ghost px-3 py-2 text-[11px]">
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirming('selected')}
                className="btn-primary px-3 py-2 text-[11px]"
                style={{ background: 'var(--accent-deep)' }}
              >
                Delete {selected.size}
              </button>
            </>
          )}

          {selected.size === 0 && unculled.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirming('all-unculled')}
              className="btn-ghost px-3 py-2 text-[11px]"
            >
              Delete all not chosen ({unculled.length})
            </button>
          )}
        </div>
      </div>

      {selected.size === 0 && visible.length > 0 && (
        <div className="text-[11px] uppercase tracking-[0.1em] text-dim">
          Click a photo to select.{' '}
          <button onClick={selectAllVisible} className="text-text underline-offset-2 hover:underline">
            Select all visible
          </button>
        </div>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-line py-24 text-center">
          <p className="display text-2xl text-muted">
            {filter === 'favorites' ? 'No favourites yet.' : filter === 'unculled' ? 'Nothing left to cull — all chosen.' : 'No photos.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {visible.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <li key={p.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={isSelected}
                  className="cell aspect-square block w-full text-left"
                  style={{
                    outline: isSelected ? '3px solid var(--accent)' : 'none',
                    outlineOffset: '-3px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/g/${gallerySlug}/photo/${p.id}?v=thumb`}
                    alt={p.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition-opacity"
                    style={{ opacity: !p.isFavorite && filter === 'all' ? 0.55 : 1 }}
                  />
                  {p.isFavorite && (
                    <>
                      <span className="fav-clip" />
                      <span className="fav-dot" />
                    </>
                  )}
                  {p.favoriteCount > 1 && (
                    <div className="absolute bottom-1 right-1 tabular bg-accent px-1.5 py-0.5 text-[10px] font-bold" style={{ color: 'var(--on-accent)' }}>
                      ×{p.favoriteCount}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute bottom-1 left-1 tabular bg-accent px-1.5 py-0.5 text-[10px] font-bold" style={{ color: 'var(--on-accent)' }}>
                      ✓
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirm modal */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-5"
          onClick={() => !busy && setConfirming(null)}
        >
          <div
            className="w-full max-w-md border border-line bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              <span className="h-px w-8 bg-accent" />
              <span>Destructive action</span>
            </div>
            <h2 className="display mt-4 text-3xl text-text">
              {confirming === 'selected'
                ? `Delete ${selected.size} ${selected.size === 1 ? 'photo' : 'photos'}?`
                : `Delete ${unculled.length} unchosen ${unculled.length === 1 ? 'photo' : 'photos'}?`}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {confirming === 'selected'
                ? 'The selected photos and their stored files will be removed permanently. Favourites by clients are also cleared.'
                : `Every photo not marked as favourite will be removed permanently — that's ${unculled.length} of ${photos.length} total.`}{' '}
              This cannot be undone.
            </p>

            {error && (
              <div className="mt-4 border border-line bg-bg px-3 py-2 text-xs text-text">
                Failed: {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirming(null)}
                disabled={busy || pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  bulkDelete(
                    confirming === 'selected'
                      ? Array.from(selected)
                      : unculled.map((p) => p.id)
                  )
                }
                disabled={busy || pending}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-deep)', color: 'var(--on-accent)' }}
              >
                {busy || pending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-baseline gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition"
      style={{
        background: active ? 'var(--surface)' : 'var(--bg)',
        color: active ? (accent ? 'var(--accent)' : 'var(--text)') : 'var(--muted)',
      }}
    >
      <span>{label}</span>
      <span className="tabular text-[10px]" style={{ color: active ? 'inherit' : 'var(--dim)' }}>
        {String(count).padStart(2, '0')}
      </span>
    </button>
  );
}
