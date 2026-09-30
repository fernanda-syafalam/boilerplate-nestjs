import type { AppConfigService } from '../../../config';

export const JWT_ALGORITHM = 'HS256' as const;

export function jwtOptions(config: AppConfigService) {
  return {
    secret: config.get('app.jwt.secret', { infer: true }),
    issuer: config.get('app.jwt.issuer', { infer: true }),
    audience: config.get('app.jwt.audience', { infer: true }),
  };
}
