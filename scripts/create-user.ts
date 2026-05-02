import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { users } from '../src/lib/db/schema';

async function main() {
  const rl = readline.createInterface({ input, output });
  const email = (await rl.question('Email: ')).trim().toLowerCase();
  const name = (await rl.question('Name: ')).trim();
  const studioName = (await rl.question('Studio name (optional): ')).trim();
  const password = await rl.question('Password: ');
  rl.close();

  if (!email || !password) {
    console.error('Email and password are required.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ email, name: name || null, studioName: studioName || null, passwordHash })
    .returning({ id: users.id, email: users.email });

  console.log(`Created user ${created.email} (${created.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
