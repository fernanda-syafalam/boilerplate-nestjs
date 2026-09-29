import { getOptionsToken } from '@nestjs/throttler';

/** Replaces the Redis-backed options factory; with no `storage` the throttler falls back to memory. */
export const inMemoryThrottler = {
  token: getOptionsToken(),
  options: { throttlers: [{ ttl: 60_000, limit: 1_000_000 }] },
};
