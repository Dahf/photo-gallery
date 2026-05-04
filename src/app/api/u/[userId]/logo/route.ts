import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buckets, getRangedObject } from '@/lib/s3';

export const runtime = 'nodejs';

// Public logo proxy — streams the studio's logo from S3 through Next.js so the
// photos bucket can stay private. No auth: logos are branding shown to clients.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;

  const [user] = await db
    .select({ id: users.id, logoUrl: users.logoUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || !user.logoUrl) return new Response('Not found', { status: 404 });

  const key = `branding/${userId}/logo`;
  const res = await getRangedObject(buckets.photos, key);

  return new Response(res.Body as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': res.ContentType ?? 'image/png',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      ...(res.ContentLength != null ? { 'Content-Length': String(res.ContentLength) } : {}),
    },
  });
}
