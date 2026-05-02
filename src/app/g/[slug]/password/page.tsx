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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
      <form
        action={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8"
      >
        <h1 className="text-2xl font-semibold">{gallery.title}</h1>
        <p className="text-sm text-neutral-500">This gallery is password protected.</p>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Incorrect password.
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Password</span>
          <input
            name="password"
            type="password"
            required
            autoFocus
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
