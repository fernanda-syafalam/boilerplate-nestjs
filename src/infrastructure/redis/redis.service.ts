import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfigService } from '../../config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: Redis;

  constructor(
    @Inject(ConfigService) config: AppConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisService.name);
    this.client = new Redis(config.get('app.redis.url', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
    this.logger.info('redis client connected');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      // quit can race in-flight commands; force-close and keep the cause visible.
      this.logger.warn({ err }, 'redis quit failed, forcing disconnect');
      this.client.disconnect();
      return;
    }
    this.logger.info('redis client closed');
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
