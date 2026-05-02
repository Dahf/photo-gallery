import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  async function logout() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 pt-8 sm:px-12 sm:pt-10">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <Link href="/dashboard" className="text-ink hover:text-seal transition">
            Snapshare ⁕ Studio
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/dashboard" className="hover:text-ink transition">Galleries</Link>
            <Link href="/dashboard/settings" className="hover:text-ink transition">Settings</Link>
            <form action={logout}>
              <button type="submit" className="hover:text-seal transition">
                Sign out →
              </button>
            </form>
          </nav>
        </div>
        <div className="rule mt-4" />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14 sm:px-12">{children}</main>
    </div>
  );
}
