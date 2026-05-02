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
      <header className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 bg-accent" />
          <span className="text-sm font-semibold tracking-tight">Snapshot</span>
        </Link>
        <span className="text-xs uppercase tracking-[0.12em] text-dim">Studio sign-in</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <form action={login} className="fade-up w-full max-w-md">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-8 bg-accent" />
            <span>Studio</span>
          </div>

          <h1 className="display fade-up-1 mt-5 text-5xl text-text sm:text-6xl">
            Sign in.
          </h1>

          <p className="fade-up-2 mt-4 text-base text-muted">
            Enter your credentials to manage galleries.
          </p>

          <ErrorBanner searchParams={searchParams} />

          <div className="fade-up-3 mt-8 space-y-5">
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field label="Password" name="password" type="password" autoComplete="current-password" />
            <button type="submit" className="btn-primary w-full justify-center">
              Enter studio
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </div>

      <footer className="border-t border-line px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-dim">
          <span>Snapshot · self-hosted</span>
          <span>silasbeckmann.de</span>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} required className="input mt-2" />
    </label>
  );
}

async function ErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div
      className="fade-up-2 mt-6 px-4 py-3 text-sm"
      style={{ color: 'var(--warn)', borderColor: 'rgba(255,106,61,0.5)', background: 'rgba(255,106,61,0.08)', border: '1px solid rgba(255,106,61,0.5)' }}
    >
      Email or password did not match.
    </div>
  );
}
