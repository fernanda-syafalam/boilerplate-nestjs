/** Runtime migrator: drizzle-kit is a devDependency and is pruned from the production image. */
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { databaseEnvSchema } from '../../../config/env.schema';

// Same relative depth from src/ (tsx) and dist/ (compiled): <root>/drizzle.
const MIGRATIONS_FOLDER = resolve(__dirname, '../../../../drizzle');

async function main(): Promise<void> {
  const { DATABASE_URL } = databaseEnvSchema.parse(process.env);

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err); // design-ok: CLI script output
  process.exitCode = 1;
});
