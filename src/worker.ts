// Must load first: auto-instrumentation patches modules at import time.
import './observability/tracing';

import { NestFactory } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';
import { registerGracefulShutdown } from './observability/graceful-shutdown';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  registerGracefulShutdown(app, await app.resolve(PinoLogger));
  app.get(Logger).log('worker started');
}

void bootstrap();
