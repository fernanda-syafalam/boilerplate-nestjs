import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfigService } from '../../config';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JWT_ALGORITHM, jwtOptions } from './jwt-options';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => {
        const { secret, issuer, audience } = jwtOptions(config);
        return {
          secret,
          signOptions: {
            algorithm: JWT_ALGORITHM,
            issuer,
            audience,
            expiresIn: config.get('app.jwt.expiresIn', { infer: true }),
          },
        };
      },
    }),
    UsersModule,
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenService],
})
export class AuthModule {}
