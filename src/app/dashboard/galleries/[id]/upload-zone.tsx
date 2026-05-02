'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

type Item = { id: string; file: File; status: UploadStatus; error?: string };

const MAX_PARALLEL = 4;

export function UploadZone({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const uploadOne = useCallback(
    async (item: Item) => {
      try {
        updateItem(item.id, { status: 'uploading' });

        const presignRes = await fetch('/api/uploads/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            galleryId,
            filename: item.file.name,
            contentType: item.file.type || 'application/octet-stream',
          }),
        });
        if (!presignRes.ok) throw new Error(`presign ${presignRes.status}`);
        const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
          body: item.file,
        });
        if (!putRes.ok) throw new Error(`put ${putRes.status}`);

        updateItem(item.id, { status: 'processing' });
        const completeRes = await fetch('/api/uploads/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            galleryId,
            key,
            filename: item.file.name,
            sizeBytes: item.file.size,
          }),
        });
        if (!completeRes.ok) throw new Error(`complete ${completeRes.status}`);

        updateItem(item.id, { status: 'done' });
      } catch (err) {
        updateItem(item.id, { status: 'error', error: (err as Error).message });
      }
    },
    [galleryId]
  );

  const startUploads = useCallback(
    async (newItems: Item[]) => {
      const queue = [...newItems];
      const workers: Promise<void>[] = [];
      const runOne = async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next) await uploadOne(next);
        }
      };
      for (let i = 0; i < MAX_PARALLEL; i++) workers.push(runOne());
      await Promise.all(workers);
      router.refresh();
    },
    [uploadOne, router]
  );

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: Item[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file, i) => ({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        status: 'queued' as const,
      }));
    if (newItems.length === 0) return;
    setItems((prev) => [...prev, ...newItems]);
    startUploads(newItems);
  };

  const pending = items.filter((i) => i.status !== 'done' && i.status !== 'error').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const done = items.filter((i) => i.status === 'done').length;

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-12 text-center transition ${
          dragOver ? 'border-accent bg-surface' : 'border-line'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="display text-2xl text-text">Drop photos · or click</div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-dim">JPG · PNG · WebP · HEIC — bulk upload</div>
      </label>

      {items.length > 0 && (
        <div className="mt-4 border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between text-text">
            <span className="tabular">
              {String(done).padStart(3, '0')} / {String(items.length).padStart(3, '0')} uploaded
              {pending > 0 && ` · ${pending} in progress`}
              {failed > 0 && ` · ${failed} failed`}
            </span>
            {pending === 0 && (
              <button
                onClick={() => setItems([])}
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-accent"
              >
                Clear
              </button>
            )}
          </div>
          {failed > 0 && (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--warn)' }}>
              {items
                .filter((i) => i.status === 'error')
                .map((i) => (
                  <li key={i.id}>
                    {i.file.name}: {i.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
