import { z } from 'zod';

function isHttpOrigin(value: string): boolean {
  const parsed = URL.parse(value);
  return (
    parsed !== null &&
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    parsed.origin === value
  );
}

const corsOrigins = z.string().transform((raw, ctx) => {
  const origins = raw.split(',').map((o) => o.trim());
  for (const origin of origins) {
    if (origin === '' || origin.includes('*') || !isHttpOrigin(origin)) {
      ctx.addIssue({
        code: 'custom',
        message: `CORS_ORIGINS entries must be exact origins (scheme://host[:port], no path, trailing slash, default port or wildcard), got "${origin}"`,
      });
      return z.NEVER;
    }
  }
  return origins;
});

// Compose/k8s `${VAR:-}` yields '', which must mean "unset" as it did before zod parsing.
const emptyAsUnset = (v: unknown) => (v === '' ? undefined : v);

const envObject = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  THROTTLER_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),

  JWT_SECRET: z.string().min(32),
  // jsonwebtoken reads a bare numeric string as milliseconds, so only unit-suffixed durations pass.
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^[1-9]\d*[smhd]$/, "JWT_EXPIRES_IN must be a duration like '15m' (unit s, m, h or d)")
    .default('15m'),
  JWT_ISSUER: z.string().min(1).default('boilerplate-nestjs'),
  JWT_AUDIENCE: z.string().min(1).default('boilerplate-nestjs'),
  // Opaque token, not a JWT; this value is the Redis TTL.
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGINS: corsOrigins.default(['http://localhost:5173']),

  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  COOKIE_SECURE: z.preprocess(emptyAsUnset, z.stringbool().default(false)),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Parsed via otelEnvSchema by observability/tracing.ts before ConfigModule exists; unset endpoint = no export.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(emptyAsUnset, z.url().optional()),
  OTEL_SERVICE_NAME: z.string().min(1).default('boilerplate-nestjs'),
  SERVICE_VERSION: z.string().default('0.0.0'),
});

export const databaseEnvSchema = envObject.pick({ DATABASE_URL: true });
export const otelEnvSchema = envObject.pick({
  OTEL_EXPORTER_OTLP_ENDPOINT: true,
  OTEL_SERVICE_NAME: true,
  SERVICE_VERSION: true,
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

export function parseEnv(): Env {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}

export type Env = z.infer<typeof envSchema>;
