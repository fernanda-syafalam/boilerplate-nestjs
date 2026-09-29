import { describe, expect, it, vi } from 'vitest';
import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  it('hashes and verifies, treating a malformed hash as a mismatch', async () => {
    const hasher = new PasswordHasher();
    const hash = await hasher.hash('pw-123456789');
    expect(await hasher.verify(hash, 'pw-123456789')).toBe(true);
    expect(await hasher.verify(hash, 'other')).toBe(false);
    expect(await hasher.verify('not-a-hash', 'pw-123456789')).toBe(false);
  });

  it('computes the dummy hash in onModuleInit so verifyDummy does not hash again', async () => {
    const hasher = new PasswordHasher();
    await hasher.onModuleInit();
    const hashSpy = vi.spyOn(hasher, 'hash');

    await hasher.verifyDummy('anything');

    expect(hashSpy).not.toHaveBeenCalled();
  });
});
