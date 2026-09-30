import { defineConfig } from 'drizzle-kit';
import { databaseEnvSchema } from './src/config/env.schema';

// drizzle-kit loads .env from the cwd before evaluating this file.
const { DATABASE_URL } = databaseEnvSchema.parse(process.env);

export default defineConfig({
  schema: './src/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
