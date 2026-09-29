import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/types/auth-user';
import type { AppConfigService } from '../../config';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt-payload';
import { toAuthUser } from './to-auth-user';

/** Rehydrates req.user from the DB per request; cache if hot. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) config: AppConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('app.jwt.secret', { infer: true }),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      issuer: config.get('app.jwt.issuer', { infer: true }),
      audience: config.get('app.jwt.audience', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return toAuthUser(user);
  }
}
