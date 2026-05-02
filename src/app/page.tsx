import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-50 p-8">
      <div className="max-w-xl space-y-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Snapshare</h1>
        <p className="text-lg text-neutral-500">
          Beautiful photo galleries for your clients. Self-hosted, no monthly fees.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Open dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
