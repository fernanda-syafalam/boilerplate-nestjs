import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppConfigService } from '../../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private readonly pool: Pool;
  public readonly db: Db;

  constructor(@Inject(ConfigService) config: AppConfigService) {
    this.pool = new Pool({
      connectionString: config.get('app.database.url', { infer: true }),
      max: config.get('app.database.poolSize', { infer: true }),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.db = drizzle(this.pool, { schema, logger: false });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('select 1');
    this.logger.log('database pool initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('database pool closed');
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch (err) {
      this.logger.warn({ err }, 'database ping failed');
      return false;
    }
  }
}
