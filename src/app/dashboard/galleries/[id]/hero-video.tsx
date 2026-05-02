'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  gallerySlug: string;
  hasVideo: boolean;
};

const ACCEPTED = 'video/mp4,video/quicktime,video/webm';
// 50 MB part size — comfortably under Cloudflare's 100 MB per-request cap.
// S3 minimum is 5 MB (last part exempt); max 10 000 parts → 500 GB ceiling.
const PART_SIZE = 50 * 1024 * 1024;
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB practical cap
const MAX_CONCURRENT_PARTS = 4;

type PartResult = { partNumber: number; etag: string };

export function HeroVideoUpload({ gallerySlug, hasVideo }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB. Max 5 GB.`);
      return;
    }
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError(`Unsupported format: ${file.type || 'unknown'}. Use mp4, mov, or webm.`);
      return;
    }

    setStatus('uploading');
    setProgress(0);

    let key: string | undefined;
    let uploadId: string | undefined;

    try {
      // 1. Initiate multipart upload
      const startRes = await fetch(`/api/g/${gallerySlug}/video/multipart/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, filename: file.name }),
      });
      if (!startRes.ok) throw new Error(`start failed (${startRes.status})`);
      ({ uploadId, key } = (await startRes.json()) as { uploadId: string; key: string });

      // 2. Slice the file into parts
      const totalParts = Math.ceil(file.size / PART_SIZE);
      const partsMeta: { partNumber: number; blob: Blob }[] = [];
      for (let i = 0; i < totalParts; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        partsMeta.push({ partNumber: i + 1, blob: file.slice(start, end) });
      }

      // 3. Upload parts with bounded concurrency, tracking progress per part
      const partProgress = new Array<number>(totalParts).fill(0);
      const updateOverall = () => {
        const sent = partProgress.reduce((s, n) => s + n, 0);
        setProgress(Math.round((sent / file.size) * 100));
      };

      const completed: PartResult[] = [];
      let cursor = 0;

      async function uploadOne(meta: { partNumber: number; blob: Blob }): Promise<PartResult> {
        const signRes = await fetch(`/api/g/${gallerySlug}/video/multipart/sign-part`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId, partNumber: meta.partNumber }),
        });
        if (!signRes.ok) throw new Error(`sign-part ${meta.partNumber} failed`);
        const { url } = (await signRes.json()) as { url: string };

        return new Promise<PartResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', url);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              partProgress[meta.partNumber - 1] = e.loaded;
              updateOverall();
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader('ETag');
              if (!etag) {
                reject(new Error(`Part ${meta.partNumber}: no ETag header (CORS expose missing?)`));
                return;
              }
              partProgress[meta.partNumber - 1] = meta.blob.size;
              updateOverall();
              resolve({ partNumber: meta.partNumber, etag: etag.replace(/"/g, '') });
            } else {
              reject(new Error(`Part ${meta.partNumber}: HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error(`Part ${meta.partNumber}: network error`));
          xhr.send(meta.blob);
        });
      }

      async function worker() {
        while (cursor < partsMeta.length) {
          const idx = cursor++;
          const result = await uploadOne(partsMeta[idx]);
          completed.push(result);
        }
      }

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENT_PARTS, partsMeta.length); i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      // 4. Complete — server stitches parts and updates DB
      setStatus('processing');
      const completeRes = await fetch(`/api/g/${gallerySlug}/video/multipart/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          uploadId,
          parts: completed,
          mime: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!completeRes.ok) {
        const detail = await completeRes.json().catch(() => ({}));
        throw new Error(`complete failed: ${detail.error ?? completeRes.statusText}`);
      }

      setStatus('done');
      setProgress(100);
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
      // Best-effort cleanup of the orphaned multipart upload
      if (key && uploadId) {
        fetch(`/api/g/${gallerySlug}/video/multipart/abort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId }),
        }).catch(() => {});
      }
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
            Plays at the top of the gallery. mp4 / mov / webm · up to 5 GB (chunked upload).
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
      {status === 'processing' && <div className="mt-4 text-xs text-dim">Finalising…</div>}
      {status === 'done' && <div className="mt-4 text-xs text-accent">✔ Saved</div>}
      {error && <div className="mt-4 text-xs" style={{ color: 'var(--warn)' }}>{error}</div>}
    </div>
  );
}
