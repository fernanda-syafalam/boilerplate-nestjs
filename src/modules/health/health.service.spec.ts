import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrizzleService } from '../../infrastructure/database/drizzle.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let drizzlePing: ReturnType<typeof vi.fn>;
  let redisPing: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    drizzlePing = vi.fn();
    redisPing = vi.fn();
    service = new HealthService(
      { ping: drizzlePing } as unknown as DrizzleService,
      { ping: redisPing } as unknown as RedisService,
    );
  });

  it('is ready when both deps respond', async () => {
    drizzlePing.mockResolvedValue(true);
    redisPing.mockResolvedValue(true);
    await expect(service.checkReadiness()).resolves.toEqual({
      ready: true,
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('reports database down', async () => {
    drizzlePing.mockResolvedValue(false);
    redisPing.mockResolvedValue(true);
    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { database: 'down', redis: 'ok' },
    });
  });

  it('reports redis down', async () => {
    drizzlePing.mockResolvedValue(true);
    redisPing.mockResolvedValue(false);
    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { database: 'ok', redis: 'down' },
    });
  });

  it('reports both down', async () => {
    drizzlePing.mockResolvedValue(false);
    redisPing.mockResolvedValue(false);
    await expect(service.checkReadiness()).resolves.toEqual({
      ready: false,
      checks: { database: 'down', redis: 'down' },
    });
  });
});
