import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { LoggingEmailGateway } from './email.gateway';

describe('LoggingEmailGateway', () => {
  it('logs template, message id and idempotency key but never the recipient', async () => {
    const info = vi.fn();
    const gateway = new LoggingEmailGateway({ info, setContext: vi.fn() } as unknown as PinoLogger);

    const { messageId } = await gateway.send({
      to: 'secret@b.test',
      templateId: 'order-confirm',
      variables: {},
      idempotencyKey: 'order-confirm-1',
    });

    expect(messageId).toMatch(/^local-[0-9a-f-]{36}$/);
    const [fields] = info.mock.calls[0] ?? [];
    expect(fields).toEqual({
      templateId: 'order-confirm',
      messageId,
      idempotencyKey: 'order-confirm-1',
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret@b.test');
  });
});
