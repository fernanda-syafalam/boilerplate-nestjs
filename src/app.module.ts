import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { type AppConfig, appConfig } from './config/configuration';
import { envSchema } from './config/env.schema';
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
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: (raw) => envSchema.parse(raw),
    }),
    AppLoggerModule,
    DrizzleModule,
    RedisModule,
    // Redis storage so the limit is shared across replicas; tests use in-memory.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService<{ app: AppConfig }, true>, redis: RedisService) => {
        const throttlers = [
          {
            ttl: config.get('app.throttler.ttlMs', { infer: true }),
            limit: config.get('app.throttler.limit', { infer: true }),
          },
        ];
        if (config.get('app.nodeEnv', { infer: true }) === 'test') {
          return { throttlers };
        }
        return {
          throttlers,
          storage: new ThrottlerStorageRedisService(redis.client),
        };
      },
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
    // Default-deny; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
