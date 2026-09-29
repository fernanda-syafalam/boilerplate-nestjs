import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokenService } from './refresh-token.service';

interface JwtPayload {
  sub: string;
  role: AuthUser['role'];
}

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
    private readonly usersRepo: UsersRepository,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersRepo.findByEmail(email);
    // Verify against a dummy hash when the user is missing so both paths look alike.
    const fakeHash = '$argon2id$v=19$m=19456,t=2,p=1$placeholder$invalid';
    const passwordOk = await argon2
      .verify(user?.passwordHash ?? fakeHash, password)
      .catch(() => false);
    if (!user || !passwordOk) {
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = await this.signAccess(user.id, user.role);
    const refresh = await this.refreshTokens.mint(user.id);
    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresInSeconds: refresh.expiresInSeconds,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const { userId, refresh } = await this.refreshTokens.rotate(rawRefreshToken);
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('invalid refresh token');
    }
    const accessToken = await this.signAccess(user.id, user.role);
    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresInSeconds: refresh.expiresInSeconds,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawRefreshToken);
  }

  private async signAccess(userId: string, role: AuthUser['role']): Promise<string> {
    const payload: JwtPayload = { sub: userId, role };
    return this.jwt.signAsync(payload);
  }
}
