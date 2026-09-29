import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.constants';
import type { SendEmailRequest } from './email.gateway';

@Injectable()
export class EmailService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<SendEmailRequest>) {}

  async sendOrderConfirmation(
    orderId: string,
    to: string,
    variables: Record<string, string>,
  ): Promise<void> {
    // jobId = idempotencyKey so BullMQ drops duplicates; BullMQ rejects ':' in custom ids.
    const idempotencyKey = `order-confirm-${orderId}`;
    await this.queue.add(
      'order-confirm',
      { to, templateId: 'order-confirm', variables, idempotencyKey },
      { jobId: idempotencyKey },
    );
  }
}
