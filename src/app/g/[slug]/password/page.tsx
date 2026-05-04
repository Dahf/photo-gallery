import { db } from '@/lib/db';
import { galleries, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { signGalleryToken, verifyPassword, galleryCookieName } from '@/lib/gallery-auth';
import { cookies } from 'next/headers';

export default async function PasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      passwordHash: galleries.passwordHash,
      studioName: users.studioName,
      logoUrl: users.logoUrl,
    })
    .from(galleries)
    .innerJoin(users, eq(users.id, galleries.userId))
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (!gallery) notFound();
  if (!gallery.passwordHash) redirect(`/g/${slug}`);

  async function submit(formData: FormData) {
    'use server';
    const password = String(formData.get('password') ?? '');
    if (!gallery.passwordHash) return;
    const ok = await verifyPassword(password, gallery.passwordHash);
    if (!ok) redirect(`/g/${slug}/password?error=1`);
    const token = await signGalleryToken(slug);
    const cookieStore = await cookies();
    cookieStore.set(galleryCookieName(slug), token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    redirect(`/g/${slug}`);
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {gallery.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gallery.logoUrl}
              alt={gallery.studioName ?? 'Studio'}
              className="h-7 w-7 shrink-0 object-cover"
            />
          ) : (
            <div className="h-2.5 w-2.5 shrink-0 bg-accent" />
          )}
          <span className="truncate text-sm font-semibold tracking-tight">
            {gallery.studioName ?? 'Studio'}
          </span>
        </div>
        <span className="text-xs uppercase tracking-[0.12em] text-dim">Sealed gallery</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <form action={submit} className="fade-up w-full max-w-md">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-8 bg-accent" />
            <span>Restricted access</span>
          </div>

          <h1 className="display fade-up-1 mt-5 text-5xl text-text sm:text-6xl">
            {gallery.title}
          </h1>

          <p className="fade-up-2 mt-4 text-base text-muted">
            This gallery is password-protected. Enter the key your photographer shared with you.
          </p>

          {error && (
            <div className="fade-up-2 mt-6 border border-warn/50 bg-warn/8 px-4 py-3 text-sm text-warn"
                 style={{ color: 'var(--warn)', borderColor: 'rgba(255,106,61,0.5)', background: 'rgba(255,106,61,0.08)' }}>
              Wrong key. Try again.
            </div>
          )}

          <div className="fade-up-3 mt-8">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Key</span>
              <input
                name="password"
                type="password"
                required
                autoFocus
                autoComplete="off"
                className="input mt-2"
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="btn-primary mt-6 w-full justify-center">
              Unlock
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </div>

      <footer className="border-t border-line px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-dim">
          <span className="truncate">{gallery.studioName ?? 'Studio'}</span>
          <span className="shrink-0">Private gallery</span>
        </div>
      </footer>
    </main>
  );
}
