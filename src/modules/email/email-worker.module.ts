import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config';
import { EMAIL_QUEUE } from './email.constants';
import { EmailGateway, LoggingEmailGateway } from './email.gateway';
import { EmailProcessor } from './email.processor';

/** Fails worker startup in production so jobs are never marked done by a gateway that sends nothing. */
export function selectEmailGateway(
  config: AppConfigService,
  logging: LoggingEmailGateway,
): EmailGateway {
  if (config.get('app.nodeEnv', { infer: true }) === 'production') {
    throw new Error('no production EmailGateway configured — bind a real adapter');
  }
  return logging;
}

/** Consumer side; imported by WorkerModule only so HTTP pods never process jobs. */
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [
    EmailProcessor,
    LoggingEmailGateway,
    {
      provide: EmailGateway,
      inject: [ConfigService, LoggingEmailGateway],
      useFactory: selectEmailGateway,
    },
  ],
})
export class EmailWorkerModule {}
