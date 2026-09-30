import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../config';
import { RedisService } from './redis.service';

const quit = vi.fn();
const disconnect = vi.fn();

vi.mock('ioredis', () => ({
  Redis: class {
    quit = quit;
    disconnect = disconnect;
  },
}));

function build() {
  const logger = { setContext: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const config = { get: () => 'redis://localhost:6379' } as unknown as AppConfigService;
  const service = new RedisService(config, logger as unknown as PinoLogger);
  return { service, logger };
}

describe('RedisService.onModuleDestroy', () => {
  it('logs closed after a clean quit', async () => {
    quit.mockResolvedValueOnce('OK');
    const { service, logger } = build();
    await service.onModuleDestroy();
    expect(logger.info).toHaveBeenCalledWith('redis client closed');
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('warns with the error and force-disconnects when quit rejects', async () => {
    const err = new Error('boom');
    quit.mockRejectedValueOnce(err);
    const { service, logger } = build();
    await service.onModuleDestroy();
    expect(logger.warn).toHaveBeenCalledWith({ err }, expect.any(String));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(logger.info).not.toHaveBeenCalledWith('redis client closed');
  });
});
