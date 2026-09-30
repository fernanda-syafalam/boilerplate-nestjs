import { defineConfig } from 'drizzle-kit';
import { databaseEnvSchema } from './src/config/env.schema';

// drizzle-kit loads .env from the cwd before evaluating this file. `generate` and `check`
// (CI static job) need no database, so credentials are optional here; `migrate`/`studio`
// then fail inside drizzle-kit instead of silently targeting localhost.
const database = databaseEnvSchema.safeParse(process.env);

export default defineConfig({
  schema: './src/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  ...(database.success && { dbCredentials: { url: database.data.DATABASE_URL } }),
  strict: true,
  verbose: true,
});
