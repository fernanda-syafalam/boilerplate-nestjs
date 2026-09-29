import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface SendEmailRequest {
  to: string;
  templateId: string;
  variables: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string;
}

/** Port; swap LoggingEmailGateway for a real provider adapter. */
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
    const messageId = `local-${Date.now()}`;
    this.logger.info(
      { to: req.to, templateId: req.templateId, messageId },
      'email gateway: pretending to send',
    );
    return { messageId };
  }
}
