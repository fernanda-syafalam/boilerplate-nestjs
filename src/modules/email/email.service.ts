import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.constants';
import { type SendEmailRequest, SendEmailRequestSchema } from './email.gateway';

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
    // Validate here so a bad address fails the caller instead of dying later in the worker.
    const request = SendEmailRequestSchema.parse({
      to,
      templateId: 'order-confirm',
      variables,
      idempotencyKey,
    });
    await this.queue.add('order-confirm', request, { jobId: idempotencyKey });
  }
}
