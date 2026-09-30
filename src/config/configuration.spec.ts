import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from './configuration';

describe('appConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps parsed env into the nested config shape', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '4000');
    vi.stubEnv('CORS_ORIGINS', 'https://a.test, https://b.test');
    vi.stubEnv('COOKIE_SECURE', 'yes');
    vi.stubEnv('JWT_EXPIRES_IN', '30m');
    // parseEnv caches per module instance, so load a fresh copy that sees the stubbed env.
    const fresh = await import('./configuration.js');
    const config = fresh.appConfig();

    expect(config.port).toBe(4000);
    expect(config.cors.origins).toEqual(['https://a.test', 'https://b.test']);
    expect(config.cookie).toEqual({ secure: true, domain: undefined, sameSite: 'lax' });
    expect(config.jwt.expiresIn).toBe('30m');
    expect(config.database.url).toBe(process.env.DATABASE_URL);
    expect(config.redis.url).toBe(process.env.REDIS_URL);
  });

  it('is registered under the app namespace', () => {
    expect(appConfig.KEY).toBe('CONFIGURATION(app)');
  });
});
