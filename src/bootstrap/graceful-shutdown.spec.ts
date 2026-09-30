import type { INestApplicationContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerGracefulShutdown } from './graceful-shutdown';

function setup(opts: { closeError?: Error; flushError?: Error } = {}) {
  const order: string[] = [];
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const close = vi.fn(async () => {
    order.push('close');
    if (opts.closeError) throw opts.closeError;
  });
  const flush = vi.fn(async () => {
    order.push('flush');
    if (opts.flushError) throw opts.flushError;
  });
  registerGracefulShutdown({ close } as unknown as INestApplicationContext, logger, flush);
  return { order, exit, logger, close, flush };
}

describe('registerGracefulShutdown', () => {
  beforeEach(() => {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  it('logs the signal, closes the app, then flushes telemetry and exits 0', async () => {
    const { order, exit, logger } = setup();

    process.emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(logger.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'shutting down');
    expect(order).toEqual(['close', 'flush']);
  });

  it('exits 1 on close failure but still flushes telemetry', async () => {
    const { exit, flush, logger } = setup({ closeError: new Error('boom') });

    process.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));

    expect(flush).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalled();
  });

  it('warns and keeps exit code 0 when the flush fails', async () => {
    const { exit, logger } = setup({ flushError: new Error('flush') });

    process.emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(logger.warn).toHaveBeenCalled();
  });

  it('ignores a second signal while shutting down', async () => {
    const { exit, close } = setup();

    process.emit('SIGTERM');
    process.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });
});
