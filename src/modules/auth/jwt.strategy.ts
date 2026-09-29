import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/types/auth-user';
import type { AppConfigService } from '../../config';
import { UsersService } from '../users/users.service';
import { JWT_ALGORITHM, jwtOptions } from './jwt-options';
import type { JwtPayload } from './jwt-payload';
import { toAuthUser } from './to-auth-user';

/** Rehydrates req.user from the DB per request; cache if hot. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) config: AppConfigService,
    private readonly users: UsersService,
  ) {
    const { secret, issuer, audience } = jwtOptions(config);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      ignoreExpiration: false,
      algorithms: [JWT_ALGORITHM],
      issuer,
      audience,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return toAuthUser(user);
  }
}
