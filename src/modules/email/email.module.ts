import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './email.constants';
import { EmailGateway, LoggingEmailGateway } from './email.gateway';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [
    EmailService,
    EmailProcessor,
    { provide: EmailGateway, useClass: LoggingEmailGateway },
  ],
  exports: [EmailService],
})
export class EmailModule {}
