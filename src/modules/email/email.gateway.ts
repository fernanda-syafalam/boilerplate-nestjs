import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { SendEmailRequest } from './dto/send-email-request.dto';

export interface SendEmailResult {
  messageId: string;
}

/** Port; adapters MUST forward idempotencyKey as the provider's idempotency key so a retry after a successful send is safe. */
export abstract class EmailGateway {
  abstract send(req: SendEmailRequest): Promise<SendEmailResult>;
}

@Injectable()
export class LoggingEmailGateway extends EmailGateway {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(LoggingEmailGateway.name);
  }

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    const messageId = `local-${randomUUID()}`;
    this.logger.info(
      { templateId: req.templateId, messageId, idempotencyKey: req.idempotencyKey },
      'email gateway: pretending to send',
    );
    return { messageId };
  }
}
