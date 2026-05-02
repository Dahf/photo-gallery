// Standalone user-creation script for production.
// Runs with plain `node` inside the runtime image — no tsx/dotenv needed.
// Reads DATABASE_URL from the env (already injected by docker compose).
//
// Usage (inside the container):
//   node scripts/create-user.mjs --email you@example.com --name "Silas" --studio "Beckmann Studio" --password "S3cret!"
//
// Or piped:
//   node scripts/create-user.mjs --email ... --password $(openssl rand -base64 18)

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const email = String(args.email ?? '').trim().toLowerCase();
const password = String(args.password ?? '');
const name = args.name ? String(args.name).trim() : null;
const studioName = args.studio ? String(args.studio).trim() : null;

if (!email || !password) {
  console.error('Missing --email or --password');
  console.error('');
  console.error('Usage: node scripts/create-user.mjs --email <email> --password <password> [--name <name>] [--studio <studio>]');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await sql`
    INSERT INTO users (email, name, studio_name, password_hash)
    VALUES (${email}, ${name}, ${studioName}, ${passwordHash})
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          studio_name = EXCLUDED.studio_name,
          password_hash = EXCLUDED.password_hash
    RETURNING id, email
  `;
  console.log(`✔ user ${created.email} (${created.id}) ready`);
  await sql.end({ timeout: 5 });
  process.exit(0);
} catch (err) {
  console.error('Failed:', err?.message ?? err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
