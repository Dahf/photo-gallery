import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  async function logout() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-5 py-3 backdrop-blur sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Snapshot" className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Snapshot Studio</span>
        </Link>
        <nav className="flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          <Link href="/dashboard" className="hover:text-text">Galleries</Link>
          <Link href="/dashboard/settings" className="hover:text-text">Settings</Link>
          <form action={logout}>
            <button type="submit" className="hover:text-accent">Sign out</button>
          </form>
          <span className="h-4 w-px bg-line-2" aria-hidden />
          <ThemeToggle />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}
