import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { z } from 'zod';

export const SendEmailRequestSchema = z.object({
  to: z.email(),
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.string()),
  idempotencyKey: z.string().min(1),
});

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

/** Paths and codes only: issue messages/values may echo the recipient address. */
export function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}:${i.code}`).join(', ');
}

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
