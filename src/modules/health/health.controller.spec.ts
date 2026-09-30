import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let checkReadiness: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    checkReadiness = vi.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { checkReadiness } }],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  it('liveness returns status ok without touching dependencies', () => {
    expect(controller.liveness()).toEqual({ status: 'ok' });
    expect(checkReadiness).not.toHaveBeenCalled();
  });

  it('readiness returns ok when the service reports ready', async () => {
    checkReadiness.mockResolvedValue({ ready: true, checks: { database: 'ok', redis: 'ok' } });
    await expect(controller.readiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('readiness throws 503 carrying only checks when not ready', async () => {
    checkReadiness.mockResolvedValue({ ready: false, checks: { database: 'down', redis: 'ok' } });
    const err = await controller.readiness().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getResponse()).toEqual({
      checks: { database: 'down', redis: 'ok' },
    });
  });
});
