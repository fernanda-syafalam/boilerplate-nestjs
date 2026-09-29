import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/configuration';
import { envSchema } from './config/env.schema';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EmailModule } from './modules/email/email.module';

/** No HTTP guards; import DB/Auth only when a processor needs them. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: (raw) => envSchema.parse(raw),
    }),
    AppLoggerModule,
    RedisModule,
    QueueModule,
    EmailModule,
  ],
})
export class WorkerModule {}
