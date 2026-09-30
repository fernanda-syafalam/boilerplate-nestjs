import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import type { AppConfigService } from '../../config';
import { RedisService } from '../../infrastructure/redis/redis.service';

type RejectReason = 'unknown_or_reused' | 'corrupt_json' | 'invalid_payload';

// Sentinel so unparseable data stays distinct from a legitimately parsed JSON value.
const CORRUPT = Symbol('corrupt');

const StoredRefreshTokenSchema = z.object({ userId: z.uuid() });

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
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RefreshTokenService.name);
  }

  async mint(userId: string): Promise<MintedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const key = this.redisKey(raw);
    const payload: z.infer<typeof StoredRefreshTokenSchema> = { userId };
    const expiresInSeconds = this.ttlSeconds();
    await this.redis.client.set(key, JSON.stringify(payload), 'EX', expiresInSeconds);
    return { token: raw, expiresInSeconds };
  }

  /** Single-use: GETDEL is atomic, so concurrent consumers yield one winner. */
  async consume(rawToken: string): Promise<string> {
    const stored = await this.redis.client.getdel(this.redisKey(rawToken));
    if (!stored) {
      // Reuse of a single-use token looks the same as an unknown one, and is the signal to watch.
      return this.reject('unknown_or_reused');
    }
    const json = this.parseJson(stored);
    if (json === CORRUPT) {
      return this.reject('corrupt_json');
    }
    const parsed = StoredRefreshTokenSchema.safeParse(json);
    if (!parsed.success) {
      return this.reject('invalid_payload');
    }
    return parsed.data.userId;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.redis.client.del(this.redisKey(rawToken));
  }

  private reject(reason: RejectReason): never {
    // Never log the token or stored value: both are credentials.
    this.logger.warn({ reason }, 'refresh rejected');
    throw new UnauthorizedException('invalid refresh token');
  }

  private parseJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return CORRUPT;
    }
  }

  private redisKey(rawToken: string): string {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    return `${RefreshTokenService.REDIS_KEY_PREFIX}${hash}`;
  }

  private ttlSeconds(): number {
    return this.config.get('app.jwt.refreshTokenTtlSeconds', { infer: true });
  }
}
