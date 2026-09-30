import * as argon2 from 'argon2';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { PasswordHasher } from './password-hasher';

vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return { ...actual, verify: vi.fn(actual.verify) };
});

function buildHasher() {
  const logger = { warn: vi.fn(), setContext: vi.fn() };
  return { hasher: new PasswordHasher(logger as unknown as PinoLogger), logger };
}

describe('PasswordHasher', () => {
  it('hashes and verifies, treating a malformed hash as a logged mismatch', async () => {
    const { hasher, logger } = buildHasher();
    const hash = await hasher.hash('pw-123456789');
    expect(await hasher.verify(hash, 'pw-123456789')).toBe(true);
    expect(await hasher.verify(hash, 'other')).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(await hasher.verify('not-a-hash', 'pw-123456789')).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-TypeError failures instead of reporting a mismatch', async () => {
    const { hasher, logger } = buildHasher();
    const failure = new Error('native binding failed');
    vi.mocked(argon2.verify).mockRejectedValueOnce(failure);

    await expect(hasher.verify('any', 'pw')).rejects.toBe(failure);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('computes the dummy hash in onModuleInit so verifyDummy does not hash again', async () => {
    const { hasher } = buildHasher();
    await hasher.onModuleInit();
    const hashSpy = vi.spyOn(hasher, 'hash');

    await hasher.verifyDummy('anything');

    expect(hashSpy).not.toHaveBeenCalled();
  });
});
