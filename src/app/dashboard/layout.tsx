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
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Snapshare
          </Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-600">
            <Link href="/dashboard" className="hover:text-neutral-900">
              Galleries
            </Link>
            <Link href="/dashboard/settings" className="hover:text-neutral-900">
              Settings
            </Link>
            <form action={logout}>
              <button type="submit" className="hover:text-neutral-900">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
