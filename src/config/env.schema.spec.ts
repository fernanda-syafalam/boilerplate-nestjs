import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema';

const base = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/app',
  JWT_SECRET: 'test-secret-must-be-at-least-32-characters-long',
};

describe('envSchema', () => {
  it('defaults TRUST_PROXY_HOPS to 0 and accepts 1', () => {
    expect(envSchema.parse(base).TRUST_PROXY_HOPS).toBe(0);
    expect(envSchema.parse({ ...base, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
  });

  it('rejects a negative or fractional TRUST_PROXY_HOPS', () => {
    expect(envSchema.safeParse({ ...base, TRUST_PROXY_HOPS: '-1' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, TRUST_PROXY_HOPS: '1.5' }).success).toBe(false);
  });

  it('rejects wildcards in CORS_ORIGINS', () => {
    expect(envSchema.safeParse({ ...base, CORS_ORIGINS: '*' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, CORS_ORIGINS: 'https://*.example.com' }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...base, CORS_ORIGINS: 'https://a.test' }).success).toBe(true);
  });

  it('requires COOKIE_SECURE=true in production', () => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'production' }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true' }).success,
    ).toBe(true);
  });

  it('requires COOKIE_SECURE=true when COOKIE_SAMESITE=none', () => {
    expect(envSchema.safeParse({ ...base, COOKIE_SAMESITE: 'none' }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }).success,
    ).toBe(true);
  });

  it('defaults JWT_ISSUER and JWT_AUDIENCE', () => {
    const env = envSchema.parse(base);
    expect(env.JWT_ISSUER).toBe('boilerplate-nestjs');
    expect(env.JWT_AUDIENCE).toBe('boilerplate-nestjs');
  });
});
