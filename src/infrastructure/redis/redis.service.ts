import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfigService } from '../../config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(@Inject(ConfigService) config: AppConfigService) {
    this.client = new Redis(config.get('app.redis.url', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
    this.logger.log('redis client connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => {
      // quit can race in-flight commands; force-close.
      this.client.disconnect();
    });
    this.logger.log('redis client closed');
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.client.ping();
      return reply === 'PONG';
    } catch (err) {
      this.logger.warn({ err }, 'redis ping failed');
      return false;
    }
  }
}
