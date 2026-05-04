'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { currentUrl: string | null };

export function LogoUploader({ currentUrl }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setStatus('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
      setStatus('idle');
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm('Remove logo?')) return;
    setError(null);
    const res = await fetch('/api/settings/logo', { method: 'DELETE' });
    if (res.ok) {
      setUrl(null);
      router.refresh();
    } else {
      setError('Delete failed');
    }
  }

  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Logo</span>

      <div className="mt-2 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-line bg-bg">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Studio logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] uppercase tracking-[0.12em] text-dim">None</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center border border-line-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text transition hover:border-accent hover:text-accent">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = '';
              }}
            />
            {url ? 'Replace logo' : 'Upload logo'}
          </label>
          {url && (
            <button
              type="button"
              onClick={remove}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-warn"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-dim">
        Square PNG / JPEG / WebP / SVG · up to 5 MB. Shown in the gallery header.
      </div>

      {status === 'uploading' && <div className="mt-2 text-xs text-dim">Uploading…</div>}
      {error && <div className="mt-2 text-xs" style={{ color: 'var(--warn)' }}>{error}</div>}
    </div>
  );
}
