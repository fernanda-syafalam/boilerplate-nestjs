import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { DrizzleService } from '../../infrastructure/database/drizzle.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

interface LivenessStatus {
  status: 'ok';
}

type DependencyState = 'ok' | 'down';

interface ReadinessStatus {
  status: 'ok';
  checks: {
    database: DependencyState;
    redis: DependencyState;
  };
}

/** Liveness is dependency-free so a slow DB does not restart every pod; readiness pings dependencies. */
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly redis: RedisService,
  ) {}

  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  liveness(): LivenessStatus {
    return { status: 'ok' };
  }

  @Get('readyz')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<ReadinessStatus> {
    const [databaseOk, redisOk] = await Promise.all([this.drizzle.ping(), this.redis.ping()]);

    if (!databaseOk || !redisOk) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        checks: {
          database: databaseOk ? 'ok' : 'down',
          redis: redisOk ? 'ok' : 'down',
        },
      });
    }

    return {
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    };
  }
}
