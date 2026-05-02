'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  gallerySlug: string;
  hasVideo: boolean;
};

const ACCEPTED = 'video/mp4,video/quicktime,video/webm';
const MAX_BYTES = 95 * 1024 * 1024; // Cloudflare free tier hard limit ≈ 100 MB

export function HeroVideoUpload({ gallerySlug, hasVideo }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Too large: ${(file.size / 1024 / 1024).toFixed(0)} MB. Max 95 MB (Cloudflare proxy limit).`);
      return;
    }
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError(`Unsupported format: ${file.type || 'unknown'}. Use mp4, mov, or webm.`);
      return;
    }

    setStatus('uploading');
    setProgress(0);

    try {
      const presign = await fetch(`/api/g/${gallerySlug}/video/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, filename: file.name }),
      });
      if (!presign.ok) throw new Error(`presign failed (${presign.status})`);
      const { uploadUrl, key } = (await presign.json()) as { uploadUrl: string; key: string };

      // XHR for upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      setStatus('processing');
      const complete = await fetch(`/api/g/${gallerySlug}/video/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mime: file.type, sizeBytes: file.size }),
      });
      if (!complete.ok) throw new Error(`complete failed (${complete.status})`);

      setStatus('done');
      setProgress(100);
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }

  async function deleteVideo() {
    if (!confirm('Remove hero video?')) return;
    const res = await fetch(`/api/g/${gallerySlug}/video`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else setError('Delete failed');
  }

  return (
    <div className="border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Hero video</div>
          <div className="mt-1 text-xs text-dim">
            Plays at the top of the gallery. mp4 / mov / webm · max ~95 MB.
          </div>
        </div>
        {hasVideo && (
          <button
            type="button"
            onClick={deleteVideo}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-warn"
            style={{ color: 'inherit' }}
          >
            Remove
          </button>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-center justify-center border border-dashed border-line p-6 text-center transition hover:border-accent">
        <input
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = '';
          }}
        />
        <span className="text-sm text-text">
          {hasVideo ? 'Replace video — click to choose' : 'Click to choose video'}
        </span>
      </label>

      {status === 'uploading' && (
        <div className="mt-4">
          <div className="tabular text-xs text-dim">Uploading… {progress}%</div>
          <div className="mt-1 h-1 w-full bg-line">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'processing' && <div className="mt-4 text-xs text-dim">Saving…</div>}
      {status === 'done' && <div className="mt-4 text-xs text-accent">✔ Saved</div>}
      {error && <div className="mt-4 text-xs" style={{ color: 'var(--warn)' }}>{error}</div>}
    </div>
  );
}
