'use client';

import { useMemo, useState } from 'react';
import type { GalleryKpis, DailyBucket, TopPhoto } from '@/lib/analytics';

type SortKey = 'engagement' | 'views' | 'downloads' | 'favorites';

export function StatsView({
  gallerySlug,
  stats,
}: {
  gallerySlug: string;
  stats: { kpis: GalleryKpis; daily: DailyBucket[]; topPhotos: TopPhoto[] };
}) {
  const { kpis, daily, topPhotos } = stats;
  const [sortKey, setSortKey] = useState<SortKey>('engagement');

  const sortedPhotos = useMemo(
    () => [...topPhotos].sort((a, b) => b[sortKey] - a[sortKey]),
    [topPhotos, sortKey]
  );

  const downloadsTotal = kpis.downloads + kpis.downloadsZip;

  return (
    <div className="space-y-10">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <Kpi n={kpis.uniqueSessions} label="Unique visitors" />
        <Kpi n={kpis.views} label="Photo views" />
        <Kpi
          n={downloadsTotal}
          label="Downloads"
          sub={
            kpis.downloadsZip > 0 || kpis.downloads > 0
              ? `${kpis.downloads} single · ${kpis.downloadsZip} zip`
              : undefined
          }
        />
        <Kpi n={kpis.favoritesNet} label="Favourites" accent />
      </div>

      {/* 30-day chart */}
      <DailyChart daily={daily} />

      {/* Top photos table */}
      <div>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text">
            Top photos
          </h2>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-dim">
            <span>Sort</span>
            <SortPill active={sortKey === 'engagement'} onClick={() => setSortKey('engagement')}>
              Engagement
            </SortPill>
            <SortPill active={sortKey === 'views'} onClick={() => setSortKey('views')}>
              Views
            </SortPill>
            <SortPill active={sortKey === 'downloads'} onClick={() => setSortKey('downloads')}>
              Downloads
            </SortPill>
            <SortPill active={sortKey === 'favorites'} onClick={() => setSortKey('favorites')}>
              Favs
            </SortPill>
          </div>
        </div>

        {sortedPhotos.length === 0 ? (
          <div className="border border-dashed border-line py-16 text-center mt-4">
            <p className="display text-2xl text-muted">No photo activity yet.</p>
            <p className="mt-2 text-xs text-dim">
              Stats appear after the first client opens the gallery.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line">
            {sortedPhotos.map((p, i) => (
              <li
                key={p.photoId}
                className="grid grid-cols-[40px_72px_1fr_repeat(4,minmax(0,72px))] items-center gap-3 bg-surface px-3 py-2 text-sm sm:px-4"
              >
                <span className="tabular text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                <div className="cell aspect-square h-14 w-14">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/g/${gallerySlug}/photo/${p.photoId}?v=thumb`}
                    alt={p.filename}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="truncate text-text" title={p.filename}>
                  {p.filename}
                </div>
                <Cell n={p.views} dim={sortKey !== 'views'} />
                <Cell n={p.downloads} dim={sortKey !== 'downloads'} />
                <Cell n={p.favorites} dim={sortKey !== 'favorites'} accent={sortKey === 'favorites'} />
                <Cell n={p.engagement} dim={sortKey !== 'engagement'} accent={sortKey === 'engagement'} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 text-[11px] uppercase tracking-[0.1em] text-dim">
          Engagement = views × 1 + downloads × 3 + favourites × 5
        </div>
      </div>
    </div>
  );
}

function Kpi({
  n,
  label,
  sub,
  accent,
}: {
  n: number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-bg p-5">
      <div
        className="display tabular text-3xl"
        style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {String(n).padStart(2, '0')}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{label}</div>
      {sub && <div className="tabular text-[10px] text-dim">{sub}</div>}
    </div>
  );
}

function SortPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border px-2.5 py-1 text-[11px] font-semibold transition"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--line-2)',
        color: active ? 'var(--accent)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

function Cell({ n, dim, accent }: { n: number; dim?: boolean; accent?: boolean }) {
  return (
    <span
      className="tabular text-right text-sm"
      style={{
        color: accent ? 'var(--accent)' : dim ? 'var(--dim)' : 'var(--text)',
        fontWeight: accent ? 700 : 400,
      }}
    >
      {n === 0 ? '·' : n}
    </span>
  );
}

function DailyChart({ daily }: { daily: DailyBucket[] }) {
  const max = Math.max(1, ...daily.map((d) => d.views + d.downloads + d.favorites));
  const total = daily.reduce((s, d) => s + d.views + d.downloads + d.favorites, 0);

  return (
    <div className="border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Last 30 days
          </div>
          <div className="mt-1 tabular text-xs text-dim">
            {total} {total === 1 ? 'event' : 'events'} total
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.1em] text-dim">
          <Legend swatch="var(--accent)" label="Views" />
          <Legend swatch="var(--accent-deep)" label="Downloads" />
          <Legend swatch="var(--text)" label="Favs" />
        </div>
      </div>

      <div className="mt-5 flex h-32 items-end gap-[3px]">
        {daily.map((d) => {
          const sum = d.views + d.downloads + d.favorites;
          const heightPct = (sum / max) * 100;
          const tooltip = `${d.day} · ${d.views}v / ${d.downloads}d / ${d.favorites}f`;
          return (
            <div
              key={d.day}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={tooltip}
            >
              <div
                className="flex flex-col-reverse overflow-hidden transition group-hover:opacity-100"
                style={{ height: `${heightPct}%`, minHeight: sum > 0 ? '2px' : '0' }}
              >
                {d.views > 0 && (
                  <div style={{ height: `${(d.views / sum) * 100}%`, background: 'var(--accent)' }} />
                )}
                {d.downloads > 0 && (
                  <div style={{ height: `${(d.downloads / sum) * 100}%`, background: 'var(--accent-deep)' }} />
                )}
                {d.favorites > 0 && (
                  <div style={{ height: `${(d.favorites / sum) * 100}%`, background: 'var(--text)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between tabular text-[10px] text-dim">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>{daily[Math.floor(daily.length / 2)]?.day.slice(5)}</span>
        <span>{daily[daily.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2" style={{ background: swatch }} />
      <span>{label}</span>
    </span>
  );
}
