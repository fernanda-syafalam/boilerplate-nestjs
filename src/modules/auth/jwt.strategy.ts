import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { AppConfig } from '../../config/configuration';
import { UsersRepository } from '../users/users.repository';

interface JwtPayload {
  sub: string;
  role: AuthUser['role'];
  iat: number;
  exp: number;
}

/** Rehydrates req.user from the DB per request; cache if hot. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<{ app: AppConfig }, true>,
    private readonly usersRepo: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('app.jwt.secret', { infer: true }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersRepo.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  }
}
