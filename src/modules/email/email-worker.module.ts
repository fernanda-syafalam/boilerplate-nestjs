import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './email.constants';
import { EmailGateway, LoggingEmailGateway } from './email.gateway';
import { EmailProcessor } from './email.processor';

/** Consumer side; imported by WorkerModule only so HTTP pods never process jobs. */
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailProcessor, { provide: EmailGateway, useClass: LoggingEmailGateway }],
})
export class EmailWorkerModule {}
