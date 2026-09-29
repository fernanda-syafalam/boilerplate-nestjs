import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import type { AppConfigService } from './config';
import { AppConfigModule } from './config/app-config.module';
import { DrizzleModule } from './infrastructure/database/drizzle.module';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RedisService } from './infrastructure/redis/redis.service';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    DrizzleModule,
    RedisModule,
    // Redis storage so the limit is shared across replicas; e2e tests override the options token.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisService],
      useFactory: (config: AppConfigService, redis: RedisService) => ({
        throttlers: [
          {
            ttl: config.get('app.throttler.ttlMs', { infer: true }),
            limit: config.get('app.throttler.limit', { infer: true }),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis.client),
      }),
    }),
    QueueModule,
    AuthModule,
    EmailModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    // Registered via DI so PinoLogger is injected.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Throttle first so unauthenticated floods (e.g. login brute force) are limited too.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Default-deny; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
