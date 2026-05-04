import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-line px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Snapshot" className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Snapshot</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:text-text"
          >
            Sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col justify-center px-6 py-20 sm:px-12 sm:py-28">
        <div className="mx-auto w-full max-w-6xl">
          <div className="fade-up flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <span className="h-px w-10 bg-line-2" />
            <span>Self-hosted gallery system</span>
          </div>

          <h1 className="display fade-up fade-up-1 mt-8 text-[clamp(3rem,11vw,11rem)] text-text">
            Photos
            <br />
            you <span className="text-accent">own</span>.
            <br />
            Galleries
            <br />
            that <span className="text-accent">stay</span>.
          </h1>

          <div className="fade-up fade-up-2 mt-12 grid grid-cols-1 gap-10 sm:grid-cols-12">
            <p className="sm:col-span-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              A photo-gallery system that runs on your own machine. No subscription, no telemetry,
              no surprise pricing changes. Send a link, your client opens a fast, dense, focused
              gallery — and that's it.
            </p>
            <div className="flex items-start gap-4 sm:col-span-6 sm:justify-end">
              <Link href="/dashboard" className="btn-primary">
                Open studio
                <span aria-hidden>→</span>
              </Link>
              <Link href="/login" className="btn-ghost">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Spec table — pro-tool aesthetic */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            ['01', 'Self-hosted', 'Runs on your own VPS, your storage, your domain.'],
            ['02', 'No subscription', 'Set up once. No per-gallery fees, no client seats.'],
            ['03', 'Fast', 'Direct-to-storage uploads. CDN-cached delivery.'],
            ['04', 'Sealed links', 'Optional per-gallery passwords. Cookie-based access.'],
          ].map(([n, title, body]) => (
            <div key={n} className="flex flex-col gap-3 bg-bg p-6 sm:p-8">
              <div className="tabular text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                / {n}
              </div>
              <div className="display text-2xl">{title}</div>
              <div className="text-sm leading-relaxed text-muted">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs uppercase tracking-[0.12em] text-dim">
          <span>Snapshot · self-hosted</span>
          <span>silasbeckmann.de</span>
        </div>
      </footer>
    </main>
  );
}
