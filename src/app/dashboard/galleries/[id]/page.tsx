import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { publicPhotoUrl } from '@/lib/s3';
import Link from 'next/link';
import { UploadZone } from './upload-zone';
import { env } from '@/lib/env';

export default async function GalleryAdminPage({
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

  const photoList = await db
    .select()
    .from(photos)
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const shareUrl = `${env.APP_URL}/g/${gallery.slug}`;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link href="/dashboard" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-text">
            ← Galleries
          </Link>
          <h1 className="display mt-4 text-4xl text-text sm:text-5xl">{gallery.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-dim">
            <span className="tabular">{photoList.length.toString().padStart(3, '0')} photos</span>
            <span>· /{gallery.slug}</span>
            {gallery.passwordHash && (
              <span className="bg-accent px-1.5 py-0.5 text-[10px] font-bold text-bg">Sealed</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/galleries/${gallery.id}/favorites`} className="btn-ghost">
            Favourites
          </Link>
          <Link href={`/g/${gallery.slug}`} target="_blank" className="btn-primary">
            Client view
            <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>

      {/* Share-link card */}
      <div className="border border-line bg-surface p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Share link</div>
        <code className="mt-2 block break-all text-sm text-text">{shareUrl}</code>
      </div>

      <UploadZone galleryId={gallery.id} />

      {photoList.length === 0 ? (
        <div className="border border-dashed border-line py-24 text-center">
          <p className="display text-2xl text-muted">Drop photos above to upload.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {photoList.map((p, idx) => (
            <li key={p.id} className="cell aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicPhotoUrl(p.s3KeyThumb)}
                alt={p.filename}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-1 right-1 tabular bg-bg/85 px-1 text-[10px] text-text">
                {String(idx + 1).padStart(3, '0')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
