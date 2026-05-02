import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { galleries, photos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hasGalleryAccess, getOrSetClientSession } from '@/lib/gallery-auth';
import { buckets, getObjectStream } from '@/lib/s3';
import { recordEvent } from '@/lib/analytics';
import archiver from 'archiver';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      passwordHash: galleries.passwordHash,
      downloadEnabled: galleries.downloadEnabled,
    })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery) return new Response('Not found', { status: 404 });
  if (!gallery.downloadEnabled) return new Response('Download disabled', { status: 403 });
  if (!(await hasGalleryAccess(slug, gallery.passwordHash))) {
    return new Response('Forbidden', { status: 403 });
  }

  const list = await db
    .select({ filename: photos.filename, key: photos.s3KeyOriginal })
    .from(photos)
    .where(eq(photos.galleryId, gallery.id));

  if (list.length === 0) return new Response('Empty gallery', { status: 404 });

  const sessionId = await getOrSetClientSession();
  void recordEvent({ galleryId: gallery.id, eventType: 'download_zip', sessionId });

  const archive = archiver('zip', { zlib: { level: 0 } }); // Photos are already compressed
  const seenNames = new Set<string>();

  // Pump archive output into a Web ReadableStream for the Response.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      archive.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      archive.on('end', () => controller.close());
      archive.on('warning', (err) => console.warn('archiver warning:', err));
      archive.on('error', (err) => controller.error(err));

      (async () => {
        try {
          for (const item of list) {
            let name = item.filename;
            let i = 1;
            while (seenNames.has(name)) {
              const dot = item.filename.lastIndexOf('.');
              const base = dot >= 0 ? item.filename.slice(0, dot) : item.filename;
              const ext = dot >= 0 ? item.filename.slice(dot) : '';
              name = `${base}_${i}${ext}`;
              i++;
            }
            seenNames.add(name);

            const body = await getObjectStream(buckets.originals, item.key);
            if (!body) continue;
            // The SDK Body is a Node Readable in Node.js runtime.
            archive.append(body as unknown as Readable, { name });
          }
          await archive.finalize();
        } catch (err) {
          controller.error(err);
        }
      })();
    },
    cancel() {
      archive.abort();
    },
  });

  const safeName = gallery.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'gallery';
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`,
    },
  });
}
