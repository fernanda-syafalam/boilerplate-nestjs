import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.constants';
import { type SendEmailRequest, SendEmailRequestSchema, describeIssues } from './email.gateway';

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
    // A plain Error (not ZodError) so the filter answers 500 and logs it: `to` is supplied by
    // server code, not the request body, so a 400 would blame the client.
    const parsed = SendEmailRequestSchema.safeParse({
      to,
      templateId: 'order-confirm',
      variables,
      idempotencyKey,
    });
    if (!parsed.success) {
      throw new Error(`invalid email request: ${describeIssues(parsed.error)}`);
    }
    await this.queue.add('order-confirm', parsed.data, { jobId: idempotencyKey });
  }
}
