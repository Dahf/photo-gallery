'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Photo = {
  id: string;
  filename: string;
  s3KeyThumb: string;
};

export function PhotoGrid({ photos, photosBaseUrl }: { photos: Photo[]; photosBaseUrl: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(photo: Photo) {
    if (!confirm(`Delete "${photo.filename}"? This cannot be undone.`)) return;
    setDeletingId(photo.id);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Delete failed: ${body.error ?? res.statusText}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {photos.map((p, idx) => {
        const isDeleting = deletingId === p.id || pending;
        return (
          <li key={p.id} className="cell aspect-square group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${photosBaseUrl}/${p.s3KeyThumb}`}
              alt={p.filename}
              loading="lazy"
              className={`h-full w-full object-cover transition-opacity ${isDeleting ? 'opacity-30' : ''}`}
            />
            <div className="absolute bottom-1 right-1 tabular bg-bg/85 px-1 text-[10px] text-text">
              {String(idx + 1).padStart(3, '0')}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(p)}
              disabled={isDeleting}
              aria-label={`Delete ${p.filename}`}
              className="absolute top-1 right-1 hidden group-hover:flex h-6 w-6 items-center justify-center bg-bg/85 text-text hover:bg-red-600 hover:text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
