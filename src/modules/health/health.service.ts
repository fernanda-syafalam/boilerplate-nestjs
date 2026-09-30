import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../infrastructure/database/drizzle.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

export type DependencyState = 'ok' | 'down';

export interface ReadyChecks {
  database: 'ok';
  redis: 'ok';
}

export interface NotReadyChecks {
  database: DependencyState;
  redis: DependencyState;
}

export type ReadinessResult =
  | { ready: true; checks: ReadyChecks }
  | { ready: false; checks: NotReadyChecks };

@Injectable()
export class HealthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly redis: RedisService,
  ) {}

  async checkReadiness(): Promise<ReadinessResult> {
    const [databaseOk, redisOk] = await Promise.all([this.drizzle.ping(), this.redis.ping()]);

    if (databaseOk && redisOk) {
      return { ready: true, checks: { database: 'ok', redis: 'ok' } };
    }
    return {
      ready: false,
      checks: { database: databaseOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' },
    };
  }
}
