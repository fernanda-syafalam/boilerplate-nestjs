import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_QUEUE } from './email.constants';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let queueAdd: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queueAdd = vi.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken(EMAIL_QUEUE), useValue: { add: queueAdd } },
      ],
    }).compile();
    service = moduleRef.get(EmailService);
  });

  it('enqueues an order-confirm job with a stable idempotency key', async () => {
    await service.sendOrderConfirmation('order-1', 'a@b.test', { name: 'Alice' });

    expect(queueAdd).toHaveBeenCalledOnce();
    const [name, payload, options] = queueAdd.mock.calls[0] ?? [];
    expect(name).toBe('order-confirm');
    expect(payload).toMatchObject({
      to: 'a@b.test',
      templateId: 'order-confirm',
      idempotencyKey: 'order-confirm-order-1',
    });
    expect(options).toEqual({ jobId: 'order-confirm-order-1' });
  });

  it("uses a jobId without ':' (BullMQ rejects custom ids containing it)", async () => {
    await service.sendOrderConfirmation('order-1', 'a@b.test', {});

    const options = queueAdd.mock.calls[0]?.[2] as { jobId: string };
    expect(options.jobId).not.toContain(':');
  });

  it('rejects an invalid recipient before touching the queue', async () => {
    await expect(service.sendOrderConfirmation('order-1', 'not-an-email', {})).rejects.toThrow();
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
