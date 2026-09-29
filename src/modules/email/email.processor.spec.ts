import { type Job, UnrecoverableError } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { EmailGateway, type SendEmailRequest } from './email.gateway';
import { EmailProcessor } from './email.processor';

function fakeJob(data: unknown): Job<SendEmailRequest> {
  return { id: 'j-1', data, attemptsMade: 0 } as unknown as Job<SendEmailRequest>;
}

const logger = { info: vi.fn(), error: vi.fn(), setContext: vi.fn() };

describe('EmailProcessor', () => {
  it('delegates to the gateway and returns its messageId', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'm-1' });
    const gateway: Pick<EmailGateway, 'send'> = { send };
    const processor = new EmailProcessor(gateway as EmailGateway, logger as unknown as PinoLogger);

    const result = await processor.process(
      fakeJob({
        to: 'a@b.test',
        templateId: 'order-confirm',
        variables: { x: '1' },
        idempotencyKey: 'order-confirm-1',
      }),
    );

    expect(result).toEqual({ messageId: 'm-1' });
    expect(send).toHaveBeenCalledWith({
      to: 'a@b.test',
      templateId: 'order-confirm',
      variables: { x: '1' },
      idempotencyKey: 'order-confirm-1',
    });
  });

  it('rejects a malformed payload with UnrecoverableError and never calls the gateway', async () => {
    const send = vi.fn();
    const gateway: Pick<EmailGateway, 'send'> = { send };
    const processor = new EmailProcessor(gateway as EmailGateway, logger as unknown as PinoLogger);

    await expect(
      processor.process(fakeJob({ to: 'not-an-email', templateId: '', variables: {} })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(send).not.toHaveBeenCalled();
  });

  it('propagates gateway errors so BullMQ can retry', async () => {
    const send = vi.fn().mockRejectedValue(new Error('SMTP down'));
    const gateway: Pick<EmailGateway, 'send'> = { send };
    const processor = new EmailProcessor(gateway as EmailGateway, logger as unknown as PinoLogger);

    await expect(
      processor.process(
        fakeJob({
          to: 'a@b.test',
          templateId: 'order-confirm',
          variables: {},
          idempotencyKey: 'order-confirm-2',
        }),
      ),
    ).rejects.toThrow('SMTP down');
  });
});
