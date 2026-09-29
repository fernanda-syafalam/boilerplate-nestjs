import { z } from 'zod';

const envObject = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  THROTTLER_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().min(1).default('boilerplate-nestjs'),
  JWT_AUDIENCE: z.string().min(1).default('boilerplate-nestjs'),
  // Opaque token, not a JWT; this value is the Redis TTL.
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Credentials are enabled, so a wildcard origin would be unsafe.
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .refine((v) => !v.includes('*'), 'CORS_ORIGINS must not contain wildcards'),

  // Proxy hops to trust for X-Forwarded-For; 0 trusts none.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

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

export const envSchema = envObject.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    ctx.addIssue({
      code: 'custom',
      path: ['COOKIE_SECURE'],
      message: 'COOKIE_SECURE must be true in production',
    });
  }
  if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
    ctx.addIssue({
      code: 'custom',
      path: ['COOKIE_SECURE'],
      message: 'COOKIE_SAMESITE=none requires COOKIE_SECURE=true',
    });
  }
});

let cachedEnv: Env | undefined;

/** Single parse path; memoized so config and bootstrap never re-parse. */
export function parseEnv(): Env {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}

export type Env = z.infer<typeof envSchema>;
