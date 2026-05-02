import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getGalleryStats } from '@/lib/analytics';
import { StatsView } from './stats-view';

export default async function GalleryStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [gallery] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.userId, session.user.id)))
    .limit(1);
  if (!gallery) notFound();

  const stats = await getGalleryStats(gallery.id);

  return (
    <div className="space-y-8">
      <Link
        href={`/dashboard/galleries/${gallery.id}`}
        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-text"
      >
        ← Back to gallery
      </Link>

      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="h-px w-8 bg-accent" />
          <span>Stats</span>
        </div>
        <h1 className="display mt-4 text-4xl text-text sm:text-5xl">{gallery.title}</h1>
        <p className="mt-3 tabular text-sm text-muted">
          {String(stats.kpis.uniqueSessions).padStart(3, '0')} unique{' '}
          {stats.kpis.uniqueSessions === 1 ? 'visitor' : 'visitors'} ·{' '}
          {String(stats.kpis.galleryOpens).padStart(3, '0')} gallery opens
        </p>
      </div>

      <StatsView gallerySlug={gallery.slug} stats={stats} />
    </div>
  );
}
