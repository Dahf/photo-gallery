import { db } from './db';
import { galleryEvents, photos } from './db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type EventType =
  | 'view'
  | 'download'
  | 'download_zip'
  | 'favorite_add'
  | 'favorite_remove'
  | 'hero_play'
  | 'gallery_open';

type RecordArgs = {
  galleryId: string;
  photoId?: string | null;
  eventType: EventType;
  sessionId: string | null | undefined;
};

// Fire-and-forget. NEVER throws — analytics failures must not break user requests.
// Callers should ignore the returned Promise (or `void` it).
export async function recordEvent({ galleryId, photoId, eventType, sessionId }: RecordArgs): Promise<void> {
  if (!sessionId) return;
  try {
    await db.insert(galleryEvents).values({
      galleryId,
      photoId: photoId ?? null,
      eventType,
      sessionId,
    });
  } catch (err) {
    console.error('[analytics] recordEvent failed:', err);
  }
}

// Idempotent variant for `gallery_open` — emits only if no row already exists
// for (gallery, session, type='gallery_open') today. Race-safe enough: worst case
// is two opens recorded for the same session/day, which is harmless for stats.
export async function recordGalleryOpen(galleryId: string, sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const existing = await db
      .select({ id: galleryEvents.id })
      .from(galleryEvents)
      .where(
        and(
          eq(galleryEvents.galleryId, galleryId),
          eq(galleryEvents.sessionId, sessionId),
          eq(galleryEvents.eventType, 'gallery_open'),
          gte(galleryEvents.createdAt, startOfDay)
        )
      )
      .limit(1);

    if (existing.length > 0) return;

    await db.insert(galleryEvents).values({
      galleryId,
      eventType: 'gallery_open',
      sessionId,
    });
  } catch (err) {
    console.error('[analytics] recordGalleryOpen failed:', err);
  }
}

// ---- Read side -----------------------------------------------------------

export type GalleryKpis = {
  uniqueSessions: number;
  views: number;
  downloads: number;
  downloadsZip: number;
  favoritesNet: number;
  heroPlays: number;
  galleryOpens: number;
};

export type DailyBucket = {
  day: string; // YYYY-MM-DD
  views: number;
  downloads: number;
  favorites: number;
};

export type TopPhoto = {
  photoId: string;
  filename: string;
  views: number;
  downloads: number;
  favorites: number;
  engagement: number;
};

export async function getGalleryStats(galleryId: string): Promise<{
  kpis: GalleryKpis;
  daily: DailyBucket[];
  topPhotos: TopPhoto[];
}> {
  // KPIs in a single roundtrip via filtered aggregates.
  const kpiRows = await db
    .select({
      uniqueSessions: sql<number>`count(distinct ${galleryEvents.sessionId})::int`,
      views: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'view')::int`,
      downloads: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'download')::int`,
      downloadsZip: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'download_zip')::int`,
      favAdd: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'favorite_add')::int`,
      favRemove: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'favorite_remove')::int`,
      heroPlays: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'hero_play')::int`,
      galleryOpens: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'gallery_open')::int`,
    })
    .from(galleryEvents)
    .where(eq(galleryEvents.galleryId, galleryId));

  const k = kpiRows[0];
  const kpis: GalleryKpis = {
    uniqueSessions: k.uniqueSessions ?? 0,
    views: k.views ?? 0,
    downloads: k.downloads ?? 0,
    downloadsZip: k.downloadsZip ?? 0,
    favoritesNet: Math.max(0, (k.favAdd ?? 0) - (k.favRemove ?? 0)),
    heroPlays: k.heroPlays ?? 0,
    galleryOpens: k.galleryOpens ?? 0,
  };

  // Daily buckets — last 30 days, grouped by day.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);

  const dailyRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${galleryEvents.createdAt}), 'YYYY-MM-DD')`,
      views: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'view')::int`,
      downloads: sql<number>`count(*) filter (where ${galleryEvents.eventType} in ('download', 'download_zip'))::int`,
      favorites: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'favorite_add')::int`,
    })
    .from(galleryEvents)
    .where(and(eq(galleryEvents.galleryId, galleryId), gte(galleryEvents.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${galleryEvents.createdAt})`);

  const dailyMap = new Map<string, DailyBucket>(dailyRows.map((r) => [r.day, r]));
  const daily: DailyBucket[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    daily.push(dailyMap.get(key) ?? { day: key, views: 0, downloads: 0, favorites: 0 });
  }

  // Top photos — engagement = views×1 + downloads×3 + favorite_add×5.
  // Postgres doesn't see SELECT aliases inside ORDER BY when Drizzle generates
  // positional sql expressions, so we repeat the engagement formula in ORDER BY.
  const engagementExpr = sql`(
    count(*) filter (where ${galleryEvents.eventType} = 'view')
    + count(*) filter (where ${galleryEvents.eventType} = 'download') * 3
    + count(*) filter (where ${galleryEvents.eventType} = 'favorite_add') * 5
  )`;

  const topRows = await db
    .select({
      photoId: photos.id,
      filename: photos.filename,
      views: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'view')::int`,
      downloads: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'download')::int`,
      favorites: sql<number>`count(*) filter (where ${galleryEvents.eventType} = 'favorite_add')::int`,
      engagement: sql<number>`${engagementExpr}::int`,
    })
    .from(galleryEvents)
    .innerJoin(photos, eq(photos.id, galleryEvents.photoId))
    .where(eq(galleryEvents.galleryId, galleryId))
    .groupBy(photos.id, photos.filename)
    .orderBy(sql`${engagementExpr} desc`)
    .limit(50);

  return { kpis, daily, topPhotos: topRows };
}
