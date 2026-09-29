import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

/** Capped removeOn* keeps Redis bounded; per-queue overrides go in registerQueue. */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<{ app: AppConfig }, true>) => ({
        connection: { url: config.get('app.redis.url', { infer: true }) },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { count: 1_000 },
          removeOnFail: { count: 5_000 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
