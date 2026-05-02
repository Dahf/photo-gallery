import { signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err;
      redirect('/login?error=invalid');
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="px-6 pt-8 sm:px-12 sm:pt-10">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <Link href="/" className="hover:text-ink transition">← Atelier</Link>
          <span>Studio entrance</span>
        </div>
        <div className="rule mt-4" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16 sm:px-12">
        <form action={login} className="w-full max-w-md">
          <p className="rise text-center font-mono text-[10px] uppercase tracking-[0.28em] text-stone">
            Studio entrance
          </p>
          <h1 className="rise rise-delay-1 mt-4 text-center font-display font-display-tight text-6xl leading-[0.9] text-ink sm:text-7xl">
            Welcome <em className="font-normal italic text-seal">back</em>.
          </h1>

          <ErrorBanner searchParams={searchParams} />

          <div className="rise rise-delay-3 mt-10 space-y-7">
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field label="Password" name="password" type="password" autoComplete="current-password" />
            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-3 bg-ink py-4 text-xs uppercase tracking-[0.24em] text-bone transition hover:bg-seal"
            >
              <span>Enter</span>
              <span className="font-mono transition group-hover:translate-x-1">→</span>
            </button>
          </div>
        </form>
      </div>

      <footer className="px-6 pb-10 sm:px-12">
        <div className="rule mb-6" />
        <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          Self-hosted. Yours alone.
        </div>
      </footer>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-3 font-display text-2xl text-ink placeholder:text-stone/50 focus:border-seal focus:outline-none"
      />
    </label>
  );
}

async function ErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div className="rise rise-delay-2 mt-8 border border-seal/40 bg-seal/8 px-4 py-3 text-center text-sm text-seal">
      Email or password did not match.
    </div>
  );
}
