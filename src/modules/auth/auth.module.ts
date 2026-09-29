import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfigService } from '../../config';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('app.jwt.secret', { infer: true }),
        signOptions: {
          algorithm: 'HS256' as const,
          issuer: config.get('app.jwt.issuer', { infer: true }),
          audience: config.get('app.jwt.audience', { infer: true }),
          expiresIn: config.get('app.jwt.expiresIn', { infer: true }),
        },
      }),
    }),
    UsersModule,
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenService],
})
export class AuthModule {}
