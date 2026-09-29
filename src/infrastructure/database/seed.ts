/** Idempotent. Run `pnpm db:migrate` then `pnpm db:seed`; dev passwords are local only. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { PasswordHasher } from '../security/password-hasher';
import { type User, users } from './schema/users.schema';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app';

const DEV_PASSWORD = 'Passw0rd!2345';

type SeedUser = Pick<User, 'email' | 'fullName' | 'role'>;

const CANONICAL_USERS: SeedUser[] = [
  { email: 'admin@example.com', fullName: 'Ada Admin', role: 'admin' },
  { email: 'staff@example.com', fullName: 'Sam Staff', role: 'staff' },
  {
    email: 'customer@example.com',
    fullName: 'Cara Customer',
    role: 'customer',
  },
];

const EXTRA_CUSTOMERS: SeedUser[] = Array.from({ length: 12 }, (_, i) => ({
  email: `customer${i + 1}@example.com`,
  fullName: `Customer ${i + 1}`,
  role: 'customer',
}));

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema: { users } });

  const passwordHash = await new PasswordHasher().hash(DEV_PASSWORD);
  const seedUsers = [...CANONICAL_USERS, ...EXTRA_CUSTOMERS];

  let created = 0;
  try {
    const inserted = await db
      .insert(users)
      .values(seedUsers.map((user) => ({ ...user, passwordHash })))
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    created = inserted.length;
  } finally {
    await pool.end();
  }
  const skipped = seedUsers.length - created;

  console.log(`Seed complete: ${created} created, ${skipped} skipped (already present).`);
  console.log('Sign in with any seeded account, e.g.:');
  for (const user of CANONICAL_USERS) {
    console.log(`  ${user.role.padEnd(8)} ${user.email}  /  ${DEV_PASSWORD}`);
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
