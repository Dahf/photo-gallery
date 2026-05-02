import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col">
      {/* Top hairline marker */}
      <div className="px-8 pt-8 sm:px-14">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <span>Snapshare ⁕ Atelier</span>
          <span className="hidden sm:inline">No. 01 — MMXXVI</span>
          <Link href="/login" className="text-ink hover:text-seal transition">
            Sign in →
          </Link>
        </div>
        <div className="rule mt-4" />
      </div>

      {/* Editorial title block */}
      <section className="grid flex-1 grid-cols-12 gap-x-6 px-8 pb-20 pt-16 sm:px-14 sm:pt-24">
        <div className="col-span-12 lg:col-span-8">
          <p className="rise rise-delay-1 font-mono text-[11px] uppercase tracking-[0.28em] text-stone">
            For photographers who refuse the algorithm
          </p>
          <h1 className="rise rise-delay-2 font-display font-display-tight mt-8 text-[clamp(3.5rem,11vw,11rem)] leading-[0.86] text-ink">
            The quiet
            <br />
            <em className="font-normal italic">opposite</em> of a
            <br />
            stock template.
          </h1>
          <p className="rise rise-delay-3 mt-10 max-w-xl text-lg leading-relaxed text-char">
            Hand-set photographic galleries for clients — printed in pixels, served from a server you
            actually own. No subscription, no telemetry, no tasteful little watermark in the corner.
          </p>

          <div className="rise rise-delay-4 mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 bg-ink px-6 py-4 text-sm tracking-wide text-bone transition hover:bg-seal"
            >
              <span>Open the studio</span>
              <span className="font-mono transition group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/login"
              className="text-sm tracking-wide text-ink underline decoration-stone decoration-1 underline-offset-[6px] hover:decoration-seal hover:text-seal"
            >
              I already have an account
            </Link>
          </div>
        </div>

        {/* Side specimen */}
        <aside className="col-span-12 mt-16 lg:col-span-4 lg:mt-0">
          <div className="lg:sticky lg:top-16">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone">Plate 001</div>
            <div className="mt-3 aspect-[3/4] overflow-hidden plate-frame">
              <div
                className="h-full w-full"
                style={{
                  background:
                    'radial-gradient(120% 80% at 30% 20%, rgba(176,144,78,0.55), transparent 60%), radial-gradient(80% 60% at 80% 90%, rgba(159,43,31,0.45), transparent 60%), linear-gradient(160deg, #2a221b 0%, #15110d 100%)',
                }}
              />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
              <span>Untitled, 2026</span>
              <span>Silver gelatin, ed. 1/3</span>
            </div>
          </div>
        </aside>
      </section>

      {/* Three-column manifesto */}
      <section className="border-t border-ink/15 px-8 py-16 sm:px-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-16">
          <Manifesto
            n="i."
            title="Yours, fully."
            body="Self-hosted on your own VPS. Your photos sit on disks you can hold. Your domain. Your terms."
          />
          <Manifesto
            n="ii."
            title="Cinema, not feed."
            body="Galleries are paced like a printed book. Plates, not posts. Your client lingers."
          />
          <Manifesto
            n="iii."
            title="Wax & ink."
            body="Favourites are stamped, not liked. Downloads stream as a single binder. No 'engagement metrics'."
          />
        </div>
      </section>

      <footer className="px-8 pb-10 pt-6 sm:px-14">
        <div className="rule mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
          <span>Snapshare — A studio of one. Made in Lower Saxony.</span>
          <span>silasbeckmann.de</span>
        </div>
      </footer>
    </main>
  );
}

function Manifesto({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-display text-3xl italic text-seal">{n}</div>
      <h3 className="font-display mt-3 text-2xl text-ink">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-char">{body}</p>
    </div>
  );
}
