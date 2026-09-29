import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
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
    private readonly config: ConfigService<{ app: AppConfig }, true>,
  ) {}

  async mint(userId: string): Promise<MintedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const key = this.redisKey(raw);
    const payload: StoredRefreshToken = { userId };
    const expiresInSeconds = this.ttlSeconds();
    await this.redis.client.set(key, JSON.stringify(payload), 'EX', expiresInSeconds);
    return { token: raw, expiresInSeconds };
  }

  async rotate(rawToken: string): Promise<{ userId: string; refresh: MintedRefreshToken }> {
    const key = this.redisKey(rawToken);
    // Atomic, so concurrent rotations yield one winner.
    const stored = await this.redis.client.getdel(key);
    if (!stored) {
      throw new UnauthorizedException('invalid refresh token');
    }
    const { userId } = JSON.parse(stored) as StoredRefreshToken;
    const refresh = await this.mint(userId);
    return { userId, refresh };
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
