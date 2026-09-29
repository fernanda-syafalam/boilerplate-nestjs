import { Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { otelSdk } from './tracing';

@Injectable()
export class OtelShutdown implements OnApplicationShutdown {
  private readonly logger = new Logger(OtelShutdown.name);

  async onApplicationShutdown(): Promise<void> {
    try {
      await otelSdk.shutdown();
    } catch (err) {
      this.logger.warn({ err }, 'otel shutdown failed');
    }
  }
}

/** Flushes telemetry after Nest has drained HTTP and closed pools. */
@Module({ providers: [OtelShutdown] })
export class ObservabilityModule {}
