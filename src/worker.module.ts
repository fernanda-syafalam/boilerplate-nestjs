import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EmailWorkerModule } from './modules/email/email-worker.module';

/** No HTTP guards; import DB/Auth only when a processor needs them. */
@Module({
  imports: [AppConfigModule, AppLoggerModule, RedisModule, QueueModule, EmailWorkerModule],
})
export class WorkerModule {}
