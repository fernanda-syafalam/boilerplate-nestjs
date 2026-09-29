import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.constants';

/** jobId = idempotencyKey, so BullMQ drops duplicates while the job is retained. */
export interface SendEmailJob {
  to: string;
  templateId: string;
  variables: Record<string, string>;
  idempotencyKey: string;
}

@Injectable()
export class EmailService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<SendEmailJob>) {}

  async sendOrderConfirmation(
    orderId: string,
    to: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const idempotencyKey = `order-confirm:${orderId}`;
    await this.queue.add(
      'order-confirm',
      { to, templateId: 'order-confirm', variables, idempotencyKey },
      { jobId: idempotencyKey },
    );
  }
}
