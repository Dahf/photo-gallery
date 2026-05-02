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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{gallery.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {photoList.length} photos • Slug: <code>{gallery.slug}</code>
            {gallery.passwordHash && ' • password protected'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/galleries/${gallery.id}/favorites`}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            View favorites
          </Link>
          <Link
            href={`/g/${gallery.slug}`}
            target="_blank"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Open client view ↗
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600">Share link:</div>
        <code className="mt-1 block text-sm">{shareUrl}</code>
      </div>

      <UploadZone galleryId={gallery.id} />

      {photoList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
          Drop photos above to upload.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photoList.map((p) => (
            <li key={p.id} className="aspect-square overflow-hidden rounded-md bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicPhotoUrl(p.s3KeyThumb)}
                alt={p.filename}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
