import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './email.constants';
import { EmailService } from './email.service';

/** Producer side only; consumers live in EmailWorkerModule. */
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
