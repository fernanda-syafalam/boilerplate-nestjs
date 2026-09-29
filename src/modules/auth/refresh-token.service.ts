import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config';
import { RedisService } from '../../infrastructure/redis/redis.service';

interface StoredRefreshToken {
  userId: string;
}

export interface MintedRefreshToken {
  token: string;
  expiresInSeconds: number;
}

/**
 * Opaque single-use tokens; Redis stores only sha256. No token-family theft detection.
 */
@Injectable()
export class RefreshTokenService {
  private static readonly REDIS_KEY_PREFIX = 'refresh:';

  constructor(
    private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async mint(userId: string): Promise<MintedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const key = this.redisKey(raw);
    const payload: StoredRefreshToken = { userId };
    const expiresInSeconds = this.ttlSeconds();
    await this.redis.client.set(key, JSON.stringify(payload), 'EX', expiresInSeconds);
    return { token: raw, expiresInSeconds };
  }

  /** Single-use: GETDEL is atomic, so concurrent consumers yield one winner. */
  async consume(rawToken: string): Promise<string> {
    const stored = await this.redis.client.getdel(this.redisKey(rawToken));
    if (!stored) {
      throw new UnauthorizedException('invalid refresh token');
    }
    return (JSON.parse(stored) as StoredRefreshToken).userId;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.redis.client.del(this.redisKey(rawToken));
  }

  private redisKey(rawToken: string): string {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    return `${RefreshTokenService.REDIS_KEY_PREFIX}${hash}`;
  }

  private ttlSeconds(): number {
    return this.config.get('app.jwt.refreshTokenTtlSeconds', { infer: true });
  }
}
