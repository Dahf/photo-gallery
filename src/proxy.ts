import { NextResponse, type NextRequest } from 'next/server';

// MVP: no-op proxy.
// Phase 8 (custom domains) will resolve custom hosts to galleries here by
// looking up `customDomains` and rewriting to `/g/<slug>`. Lookup must run in
// a Node runtime route (proxy/middleware cannot reach Postgres directly with
// the current driver), so the plan is: rewrite to an internal resolver route,
// e.g. `/__resolve/<host>`, that does the DB lookup and `redirect()`s.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
