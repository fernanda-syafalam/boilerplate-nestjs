import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client!: Redis;

  constructor(private readonly config: ConfigService<{ app: AppConfig }, true>) {}

  async onModuleInit(): Promise<void> {
    this.client = new Redis(this.config.get('app.redis.url', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    await this.client.connect();
    await this.client.ping();
    this.logger.log('redis client connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => {
      // quit can race in-flight commands; force-close.
      this.client?.disconnect();
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
