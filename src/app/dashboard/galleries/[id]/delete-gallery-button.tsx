'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteGalleryButton({
  galleryId,
  galleryTitle,
  photoCount,
}: {
  galleryId: string;
  galleryTitle: string;
  photoCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim() === galleryTitle.trim();

  async function handleDelete() {
    if (!matches) return;
    setError(null);
    const res = await fetch(`/api/galleries/${galleryId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? res.statusText);
      return;
    }
    startTransition(() => {
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="btn-ghost"
        style={{ borderColor: 'var(--line-2)' }}
      >
        Delete
        <span aria-hidden>×</span>
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-5"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md border border-line bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              <span className="h-px w-8 bg-accent" />
              <span>Destructive action</span>
            </div>

            <h2 className="display mt-4 text-3xl text-text">Delete gallery?</h2>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              This permanently removes <span className="font-semibold text-text">{galleryTitle}</span>,
              all <span className="tabular text-text">{photoCount}</span> photo
              {photoCount === 1 ? '' : 's'}, favourites, and stored files. This cannot be undone.
            </p>

            <label className="mt-6 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Type the gallery title to confirm
            </label>
            <input
              type="text"
              autoFocus
              className="input mt-2"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={galleryTitle}
              disabled={pending}
            />

            {error && (
              <div className="mt-3 border border-line bg-bg px-3 py-2 text-xs text-text">
                Failed: {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!matches || pending}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                style={
                  matches
                    ? { background: 'var(--accent-deep)', color: 'var(--on-accent)' }
                    : undefined
                }
              >
                {pending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
