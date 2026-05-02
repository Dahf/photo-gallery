import { signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  async function login(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    try {
      await signIn('credentials', { email, password, redirectTo: '/dashboard' });
    } catch (err) {
      // NextAuth throws a redirect error on success — re-throw it so Next can handle the redirect.
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err;
      redirect('/login?error=invalid');
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-50 p-8">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <ErrorBanner searchParams={searchParams} />
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      Invalid email or password.
    </div>
  );
}
