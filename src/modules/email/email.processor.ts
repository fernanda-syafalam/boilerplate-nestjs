import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job, UnrecoverableError } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  type SendEmailRequest,
  SendEmailRequestSchema,
  describeIssues,
} from './dto/send-email-request.dto';
import { EMAIL_QUEUE } from './email.constants';
import { EmailGateway, type SendEmailResult } from './email.gateway';

// IO-bound; tune concurrency to the gateway rate limit.
@Processor(EMAIL_QUEUE, { concurrency: 10 })
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly gateway: EmailGateway,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
  }

  async process(job: Job<SendEmailRequest>): Promise<SendEmailResult> {
    const parsed = SendEmailRequestSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`invalid email job payload: ${describeIssues(parsed.error)}`);
    }
    const result = await this.gateway.send(parsed.data);
    this.logger.info(
      { jobId: job?.id, idempotencyKey: parsed.data.idempotencyKey, messageId: result.messageId },
      'email sent',
    );
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SendEmailRequest> | undefined, err: Error): void {
    this.logger.error(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        idempotencyKey: job?.data?.idempotencyKey,
        err,
      },
      'email job failed',
    );
  }
}
