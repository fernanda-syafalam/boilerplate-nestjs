import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  THROTTLER_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  // Opaque token, not a JWT; this value is the Redis TTL.
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .pipe(z.boolean())
    .default(false),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Read directly by observability/tracing.ts before ConfigModule exists; unset endpoint = no export.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('boilerplate-nestjs'),
  SERVICE_VERSION: z.string().default('0.0.0'),
});

export type Env = z.infer<typeof envSchema>;
