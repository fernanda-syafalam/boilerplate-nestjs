import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from '../../config/configuration';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<{ app: AppConfig }, true>) => ({
        pinoHttp: {
          level: config.get('app.logLevel', { infer: true }),
          autoLogging: true,
          customProps: (req) => ({ requestId: req.id }),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.passwordHash',
              'req.body.token',
              'req.body.accessToken',
              'req.body.refreshToken',
              '*.password',
              '*.passwordHash',
              '*.accessToken',
              '*.refreshToken',
            ],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (req) => ({ method: req.method, url: req.url, id: req.id }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
          transport:
            config.get('app.nodeEnv', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
