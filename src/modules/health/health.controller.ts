import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService, type ReadyChecks } from './health.service';

interface LivenessStatus {
  status: 'ok';
}

interface ReadinessStatus {
  status: 'ok';
  checks: ReadyChecks;
}

/** Liveness is dependency-free so a slow DB does not restart every pod; readiness pings dependencies. */
@Public()
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  liveness(): LivenessStatus {
    return { status: 'ok' };
  }

  @Get('readyz')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<ReadinessStatus> {
    const result = await this.health.checkReadiness();
    if (!result.ready) {
      // Body is `{ checks }` only: the filter allowlists `checks` and `status` is a reserved member.
      throw new ServiceUnavailableException({ checks: result.checks });
    }
    return { status: 'ok', checks: result.checks };
  }
}
