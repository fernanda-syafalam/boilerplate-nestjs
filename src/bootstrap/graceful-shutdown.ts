import type { INestApplicationContext } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { otelSdk } from '../observability/tracing';

const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

/** Closes Nest first (drains HTTP and workers), then flushes telemetry, so drain-time spans are exported. */
export function registerGracefulShutdown(
  app: INestApplicationContext,
  logger: Pick<PinoLogger, 'info' | 'error' | 'warn'>,
): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    let exitCode = 0;
    try {
      await app.close();
    } catch (err) {
      exitCode = 1;
      logger.error({ err }, 'app close failed');
    }
    try {
      await otelSdk.shutdown();
    } catch (err) {
      logger.warn({ err }, 'otel shutdown failed');
    }
    // A leftover socket would otherwise keep the pod alive until SIGKILL.
    process.exit(exitCode);
  };

  for (const signal of SIGNALS) {
    process.once(signal, () => void shutdown(signal));
  }
}
