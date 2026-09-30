import type { INestApplicationContext } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerGracefulShutdown } from './graceful-shutdown';

vi.mock('../observability/tracing', () => ({
  otelSdk: { shutdown: vi.fn().mockResolvedValue(undefined) },
}));

describe('registerGracefulShutdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  it('logs the triggering signal, then closes the app and exits', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const order: string[] = [];
    const logger = {
      info: vi.fn(() => order.push('log')),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const app = { close: vi.fn(async () => void order.push('close')) };
    registerGracefulShutdown(app as unknown as INestApplicationContext, logger);

    process.emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(logger.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'shutting down');
    expect(order).toEqual(['log', 'close']);
  });
});
