import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PinoLogger } from 'nestjs-pino';
import type { AuthUser } from '../../common/types/auth-user';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt/jwt-payload';
import { toAuthUser } from './jwt/to-auth-user';
import { type MintedRefreshToken, RefreshTokenService } from './refresh-token.service';

/** refreshToken goes to the httpOnly cookie, never the JSON body. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresInSeconds: number;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findActiveByEmail(email);
    if (!user) {
      await this.hasher.verifyDummy(password);
      this.logger.warn('login failed');
      throw new UnauthorizedException('invalid credentials');
    }
    if (!(await this.hasher.verify(user.passwordHash, password))) {
      this.logger.warn({ userId: user.id }, 'login failed');
      throw new UnauthorizedException('invalid credentials');
    }
    return this.issue(user, await this.refreshTokens.mint(user.id));
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const userId = await this.refreshTokens.consume(rawRefreshToken);
    const user = await this.users.findActiveById(userId);
    if (!user) {
      this.logger.warn({ reason: 'user not found' }, 'refresh rejected');
      throw new UnauthorizedException('invalid refresh token');
    }
    return this.issue(user, await this.refreshTokens.mint(user.id));
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawRefreshToken);
  }

  private async issue(user: User, refresh: MintedRefreshToken): Promise<LoginResult> {
    const payload: JwtPayload = { sub: user.id };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: refresh.token,
      refreshExpiresInSeconds: refresh.expiresInSeconds,
      user: toAuthUser(user),
    };
  }
}
