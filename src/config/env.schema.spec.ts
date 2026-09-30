import { describe, expect, it } from 'vitest';
import { databaseEnvSchema, envSchema, otelEnvSchema } from './env.schema';

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

  it('splits CORS_ORIGINS into a trimmed list and defaults to the dev origin', () => {
    expect(envSchema.parse(base).CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(
      envSchema.parse({ ...base, CORS_ORIGINS: 'https://a.test, https://b.test:8080' })
        .CORS_ORIGINS,
    ).toEqual(['https://a.test', 'https://b.test:8080']);
  });

  it.each(['a,,b', 'https://a.test,', '*', 'not-a-url', 'https://a.test/path', 'ftp://a.test'])(
    'rejects CORS_ORIGINS %j',
    (CORS_ORIGINS) => {
      expect(envSchema.safeParse({ ...base, CORS_ORIGINS }).success).toBe(false);
    },
  );

  it.each(['TRUE', 'yes', '1', 'true'])('reads COOKIE_SECURE=%s as true', (COOKIE_SECURE) => {
    expect(envSchema.parse({ ...base, COOKIE_SECURE }).COOKIE_SECURE).toBe(true);
  });

  it.each(['false', '0', 'FALSE'])('reads COOKIE_SECURE=%s as false', (COOKIE_SECURE) => {
    expect(envSchema.parse({ ...base, COOKIE_SECURE }).COOKIE_SECURE).toBe(false);
  });

  it('defaults COOKIE_SECURE to false and rejects garbage', () => {
    expect(envSchema.parse(base).COOKIE_SECURE).toBe(false);
    expect(envSchema.safeParse({ ...base, COOKIE_SECURE: 'maybe' }).success).toBe(false);
  });

  it.each(['15m', '30s', '2h', '7d'])('accepts JWT_EXPIRES_IN=%s', (JWT_EXPIRES_IN) => {
    expect(envSchema.parse({ ...base, JWT_EXPIRES_IN }).JWT_EXPIRES_IN).toBe(JWT_EXPIRES_IN);
  });

  it.each(['900', '0m', '15', 'm', '1.5h', '15 m', '15w', ''])(
    'rejects JWT_EXPIRES_IN %j',
    (JWT_EXPIRES_IN) => {
      expect(envSchema.safeParse({ ...base, JWT_EXPIRES_IN }).success).toBe(false);
    },
  );
});

describe('databaseEnvSchema', () => {
  it('requires DATABASE_URL with no default', () => {
    expect(databaseEnvSchema.safeParse({}).success).toBe(false);
    expect(databaseEnvSchema.parse(base).DATABASE_URL).toBe(base.DATABASE_URL);
  });
});

describe('otelEnvSchema', () => {
  it('applies defaults and leaves the endpoint unset', () => {
    expect(otelEnvSchema.parse({})).toEqual({
      OTEL_SERVICE_NAME: 'boilerplate-nestjs',
      SERVICE_VERSION: '0.0.0',
    });
  });

  it('validates the endpoint that tracing actually uses', () => {
    expect(
      otelEnvSchema.parse({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' })
        .OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBe('http://collector:4318');
    expect(otelEnvSchema.safeParse({ OTEL_EXPORTER_OTLP_ENDPOINT: 'nope' }).success).toBe(false);
  });
});
