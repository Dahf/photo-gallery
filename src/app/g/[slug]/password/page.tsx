import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
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
    .select({ id: galleries.id, title: galleries.title, passwordHash: galleries.passwordHash })
    .from(galleries)
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
      <div className="px-6 pt-8 sm:px-12 sm:pt-10">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <span>Snapshare ⁕ Atelier</span>
          <span>Sealed envelope</span>
        </div>
        <div className="rule mt-4" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16 sm:px-12">
        <form action={submit} className="w-full max-w-md">
          {/* Wax seal at top */}
          <div className="rise mx-auto mb-10 flex h-16 w-16 items-center justify-center rounded-full text-bone shadow-[inset_0_1px_3px_rgba(255,255,255,0.25),0_8px_30px_-8px_rgba(159,43,31,0.6)]"
               style={{ background: 'radial-gradient(120% 120% at 30% 25%, var(--seal-2) 0%, var(--seal) 55%, #6e1b13 100%)' }}>
            <span className="font-display text-2xl italic">S</span>
          </div>

          <p className="rise rise-delay-1 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-stone">
            Volume — restricted access
          </p>
          <h1 className="rise rise-delay-2 mt-4 text-center font-display text-5xl leading-[0.95] text-ink sm:text-6xl">
            <em className="font-normal italic">{gallery.title}</em>
          </h1>
          <p className="rise rise-delay-3 mt-4 text-center text-base text-char">
            This gallery is sealed. Please present the key your photographer shared with you.
          </p>

          {error && (
            <div className="rise mt-6 border border-seal/40 bg-seal/8 px-4 py-3 text-center text-sm text-seal">
              The key did not turn. Please try again.
            </div>
          )}

          <div className="rise rise-delay-4 mt-10">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone">Key</span>
              <input
                name="password"
                type="password"
                required
                autoFocus
                autoComplete="off"
                className="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-3 font-display text-2xl tracking-wide text-ink placeholder:text-stone/50 focus:border-seal focus:outline-none"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              className="group mt-8 flex w-full items-center justify-center gap-3 bg-ink py-4 text-xs uppercase tracking-[0.24em] text-bone transition hover:bg-seal"
            >
              <span>Break the seal</span>
              <span className="font-mono transition group-hover:translate-x-1">→</span>
            </button>
          </div>
        </form>
      </div>

      <footer className="px-6 pb-10 sm:px-12">
        <div className="rule mb-6" />
        <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          Snapshare — A studio of one
        </div>
      </footer>
    </main>
  );
}
