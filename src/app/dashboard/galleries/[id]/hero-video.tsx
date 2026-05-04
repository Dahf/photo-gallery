'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  gallerySlug: string;
  hasVideo: boolean;
  hasOriginal: boolean;
  originalSizeBytes: number | null;
  downloadEnabled: boolean;
};

const WEB_ACCEPTED = 'video/mp4,video/quicktime,video/webm';
// 50 MB part size — comfortably under Cloudflare's 100 MB per-request cap.
// S3 minimum is 5 MB (last part exempt); max 10 000 parts → 500 GB ceiling.
const PART_SIZE = 50 * 1024 * 1024;
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB practical cap
const MAX_CONCURRENT_PARTS = 4;

type PartResult = { partNumber: number; etag: string };
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

type SlotConfig = {
  startPath: string;
  // sign-part and abort are reused across both slots; only start/complete differ.
  signPartPath: string;
  completePath: string;
  abortPath: string;
  validate: (file: File) => string | null;
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function useSlotUpload(gallerySlug: string, slot: SlotConfig) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB. Max 5 GB.`);
      return;
    }
    const validationError = slot.validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus('uploading');
    setProgress(0);

    let key: string | undefined;
    let uploadId: string | undefined;

    try {
      const startRes = await fetch(`/api/g/${gallerySlug}${slot.startPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, filename: file.name }),
      });
      if (!startRes.ok) throw new Error(`start failed (${startRes.status})`);
      ({ uploadId, key } = (await startRes.json()) as { uploadId: string; key: string });

      const totalParts = Math.ceil(file.size / PART_SIZE);
      const partsMeta: { partNumber: number; blob: Blob }[] = [];
      for (let i = 0; i < totalParts; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        partsMeta.push({ partNumber: i + 1, blob: file.slice(start, end) });
      }

      const partProgress = new Array<number>(totalParts).fill(0);
      const updateOverall = () => {
        const sent = partProgress.reduce((s, n) => s + n, 0);
        setProgress(Math.round((sent / file.size) * 100));
      };

      const completed: PartResult[] = [];
      let cursor = 0;

      async function uploadOne(meta: { partNumber: number; blob: Blob }): Promise<PartResult> {
        const signRes = await fetch(`/api/g/${gallerySlug}${slot.signPartPath}`, {
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

      setStatus('processing');
      const completeRes = await fetch(`/api/g/${gallerySlug}${slot.completePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          uploadId,
          parts: completed,
          mime: file.type || 'application/octet-stream',
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
      if (key && uploadId) {
        fetch(`/api/g/${gallerySlug}${slot.abortPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId }),
        }).catch(() => {});
      }
    }
  }

  return { status, progress, error, uploadFile, setError };
}

const WEB_SLOT: SlotConfig = {
  startPath: '/video/multipart/start',
  signPartPath: '/video/multipart/sign-part',
  completePath: '/video/multipart/complete',
  abortPath: '/video/multipart/abort',
  validate: (file) => {
    const allowed = WEB_ACCEPTED.split(',');
    if (!allowed.includes(file.type)) {
      return `Unsupported format: ${file.type || 'unknown'}. Use mp4, mov, or webm (H.264).`;
    }
    return null;
  },
};

const ORIGINAL_SLOT: SlotConfig = {
  startPath: '/video/original/multipart/start',
  signPartPath: '/video/multipart/sign-part',
  completePath: '/video/original/multipart/complete',
  abortPath: '/video/multipart/abort',
  validate: () => null, // server enforces video/* | application/octet-stream
};

export function HeroVideoUpload({
  gallerySlug,
  hasVideo,
  hasOriginal,
  originalSizeBytes,
  downloadEnabled,
}: Props) {
  const router = useRouter();
  const web = useSlotUpload(gallerySlug, WEB_SLOT);
  const original = useSlotUpload(gallerySlug, ORIGINAL_SLOT);

  async function deleteWeb() {
    if (!confirm('Remove hero video (web version)?')) return;
    const res = await fetch(`/api/g/${gallerySlug}/video`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else web.setError('Delete failed');
  }

  async function deleteOriginal() {
    if (!confirm('Remove original download file?')) return;
    const res = await fetch(`/api/g/${gallerySlug}/video/original`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else original.setError('Delete failed');
  }

  return (
    <div className="border border-line bg-surface p-5 space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Hero video</div>
        <div className="mt-1 text-xs text-dim">
          Plays at the top of the gallery. Use H.264 for the web version — H.265/HEVC will not play in
          Chrome or Firefox. Upload the original separately if you want clients to be able to download
          full quality.
        </div>
      </div>

      {/* Web slot */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text">
              Web version (plays in browser)
            </div>
            <div className="mt-1 text-xs text-dim">
              H.264 mp4 / mov / webm · up to 5 GB. Avoid H.265 / HEVC.
            </div>
          </div>
          {hasVideo && (
            <button
              type="button"
              onClick={deleteWeb}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-warn"
            >
              Remove
            </button>
          )}
        </div>

        <label className="mt-3 flex cursor-pointer items-center justify-center border border-dashed border-line p-6 text-center transition hover:border-accent">
          <input
            type="file"
            accept={WEB_ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) web.uploadFile(f);
              e.target.value = '';
            }}
          />
          <span className="text-sm text-text">
            {hasVideo ? 'Replace web version — click to choose' : 'Click to choose web version'}
          </span>
        </label>

        {web.status === 'uploading' && (
          <div className="mt-3">
            <div className="tabular text-xs text-dim">Uploading… {web.progress}%</div>
            <div className="mt-1 h-1 w-full bg-line">
              <div className="h-full bg-accent transition-all" style={{ width: `${web.progress}%` }} />
            </div>
          </div>
        )}
        {web.status === 'processing' && <div className="mt-3 text-xs text-dim">Finalising…</div>}
        {web.status === 'done' && <div className="mt-3 text-xs text-accent">✔ Saved</div>}
        {web.error && <div className="mt-3 text-xs" style={{ color: 'var(--warn)' }}>{web.error}</div>}
      </section>

      {/* Original slot */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text">
              Original (download only, optional)
            </div>
            <div className="mt-1 text-xs text-dim">
              Any video format · up to 5 GB.
              {hasOriginal && originalSizeBytes != null && (
                <> Currently uploaded: <span className="tabular">{formatSize(originalSizeBytes)}</span>.</>
              )}{' '}
              {downloadEnabled
                ? 'Visitors will see a download button.'
                : 'Downloads are disabled for this gallery — clients won’t see a download button.'}
            </div>
          </div>
          {hasOriginal && (
            <button
              type="button"
              onClick={deleteOriginal}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-warn"
            >
              Remove
            </button>
          )}
        </div>

        <label className="mt-3 flex cursor-pointer items-center justify-center border border-dashed border-line p-6 text-center transition hover:border-accent">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) original.uploadFile(f);
              e.target.value = '';
            }}
          />
          <span className="text-sm text-text">
            {hasOriginal ? 'Replace original — click to choose' : 'Click to choose original'}
          </span>
        </label>

        {original.status === 'uploading' && (
          <div className="mt-3">
            <div className="tabular text-xs text-dim">Uploading… {original.progress}%</div>
            <div className="mt-1 h-1 w-full bg-line">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${original.progress}%` }}
              />
            </div>
          </div>
        )}
        {original.status === 'processing' && <div className="mt-3 text-xs text-dim">Finalising…</div>}
        {original.status === 'done' && <div className="mt-3 text-xs text-accent">✔ Saved</div>}
        {original.error && (
          <div className="mt-3 text-xs" style={{ color: 'var(--warn)' }}>
            {original.error}
          </div>
        )}
      </section>
    </div>
  );
}
