/** Idempotent. Run `pnpm db:migrate` then `pnpm db:seed`; dev passwords are local only. */
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { type User, users } from './schema/users.schema';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app';

// Must mirror ARGON2_OPTIONS in users.service.ts.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

// Local development only.
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

  const passwordHash = await argon2.hash(DEV_PASSWORD, ARGON2_OPTIONS);
  const seedUsers = [...CANONICAL_USERS, ...EXTRA_CUSTOMERS];

  let created = 0;
  let skipped = 0;
  try {
    for (const user of seedUsers) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing) {
        skipped += 1;
        continue;
      }

      await db.insert(users).values({ ...user, passwordHash });
      created += 1;
    }
  } finally {
    await pool.end();
  }

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
