import { Injectable, Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(LoggingEmailGateway.name);

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    const messageId = `local-${Date.now()}`;
    this.logger.log(
      { to: req.to, templateId: req.templateId, messageId },
      'email gateway: pretending to send',
    );
    return { messageId };
  }
}
