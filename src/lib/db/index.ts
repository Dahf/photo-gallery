import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __snapshareClient?: ReturnType<typeof postgres>;
  __snapshareDb?: DB;
};

function getDb(): DB {
  if (globalForDb.__snapshareDb) return globalForDb.__snapshareDb;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // Cache the pool + drizzle instance on globalThis so every request reuses
  // the same singleton. Without this, every getDb() call would open a fresh
  // postgres-js pool (default max 10 conns) and exhaust Postgres after a
  // handful of requests ("sorry, too many clients already").
  const client = globalForDb.__snapshareClient ?? postgres(url, { max: 10 });
  globalForDb.__snapshareClient = client;

  const instance = drizzle(client, { schema });
  globalForDb.__snapshareDb = instance;
  return instance;
}

// Lazy proxy: db.select(...), db.insert(...), etc. all work, but the connection
// isn't opened until first method access. This keeps `next build` happy when
// DATABASE_URL isn't set during page-data collection.
export const db = new Proxy({} as DB, {
  get(_, prop: string) {
    const real = getDb() as unknown as Record<string, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
}) as DB;

export { schema };
