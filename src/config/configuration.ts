import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

export const appConfig = registerAs('app', () => {
  const env = envSchema.parse(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    database: {
      url: env.DATABASE_URL,
      poolSize: env.DATABASE_POOL_SIZE,
    },
    redis: {
      url: env.REDIS_URL,
    },
    throttler: {
      ttlMs: env.THROTTLER_TTL_MS,
      limit: env.THROTTLER_LIMIT,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
    },
    logLevel: env.LOG_LEVEL,
    cors: {
      origins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    },
    cookie: {
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      sameSite: env.COOKIE_SAMESITE,
    },
  } as const;
});

export type AppConfig = ReturnType<typeof appConfig>;
