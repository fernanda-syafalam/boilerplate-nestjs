import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RefreshTokenService } from './refresh-token.service';

const USER_1 = '00000000-0000-4000-8000-000000000001';
const USER_2 = '00000000-0000-4000-8000-000000000002';

function makeFakeRedisClient() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK' as const;
    }),
    getdel: vi.fn(async (key: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      store.delete(key);
      return value;
    }),
    del: vi.fn(async (key: string) => {
      const had = store.delete(key);
      return had ? 1 : 0;
    }),
    _store: store,
  };
}

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let client: ReturnType<typeof makeFakeRedisClient>;

  let logger: { warn: ReturnType<typeof vi.fn>; setContext: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    client = makeFakeRedisClient();
    logger = { warn: vi.fn(), setContext: vi.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: RedisService, useValue: { client } },
        {
          provide: ConfigService,
          useValue: { get: () => 604_800 },
        },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();
    service = moduleRef.get(RefreshTokenService);
  });

  it('mints a base64url token and stores it under sha256(token)', async () => {
    const { token, expiresInSeconds } = await service.mint(USER_1);
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(expiresInSeconds).toBe(604_800);
    expect(client._store.size).toBe(1);
    // Key MUST not contain the raw token (defence against Redis-dump leaks).
    const onlyKey = [...client._store.keys()][0] ?? '';
    expect(onlyKey).not.toContain(token);
    expect(onlyKey.startsWith('refresh:')).toBe(true);
  });

  it('consume returns the user id and invalidates the token (single use)', async () => {
    const minted = await service.mint(USER_1);

    await expect(service.consume(minted.token)).resolves.toBe(USER_1);
    await expect(service.consume(minted.token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown refresh token with 401', async () => {
    await expect(service.consume('never-issued-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    ['not json', 'corrupt_json'],
    ['{"userId":"not-a-uuid"}', 'invalid_payload'],
    ['{}', 'invalid_payload'],
  ])('rejects a corrupted stored value (%s) with 401 and warns', async (corrupt, reason) => {
    const { token } = await service.mint(USER_1);
    const key = [...client._store.keys()][0] ?? '';
    client._store.set(key, corrupt);

    await expect(service.consume(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(logger.warn).toHaveBeenCalledWith({ reason }, 'refresh rejected');
  });

  it('warns with a reason on reuse and never logs the token', async () => {
    const { token } = await service.mint(USER_1);
    await service.consume(token);
    await expect(service.consume(token)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith({ reason: 'unknown_or_reused' }, 'refresh rejected');
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(token);
  });

  it('revoke is safe to call with an unknown token', async () => {
    await expect(service.revoke('nope')).resolves.toBeUndefined();
  });

  it('revoke invalidates a previously minted token', async () => {
    const { token } = await service.mint(USER_2);
    await service.revoke(token);
    await expect(service.consume(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
