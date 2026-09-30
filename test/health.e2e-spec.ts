import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/infrastructure/database/drizzle.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { inMemoryThrottler } from './support/in-memory-throttler';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;
  let databaseUp = true;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(inMemoryThrottler.token)
      .useValue(inMemoryThrottler.options)
      .overrideProvider(DrizzleService)
      .useValue({
        ping: async () => databaseUp,
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
      .overrideProvider(RedisService)
      .useValue({
        // Throttler storage reads `client` directly.
        client: { call: async () => null, get: async () => null, set: async () => 'OK' },
        ping: async () => true,
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns 200 with status ok (liveness)', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /readyz returns 200 with database + redis ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('GET /readyz returns a 503 problem body carrying only checks when a dependency is down', async () => {
    databaseUp = false;
    try {
      const res = await app.inject({ method: 'GET', url: '/readyz' });
      expect(res.statusCode).toBe(503);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json()).toMatchObject({
        status: 503,
        title: 'Service Unavailable',
        checks: { database: 'down', redis: 'ok' },
      });
    } finally {
      databaseUp = true;
    }
  });
});
