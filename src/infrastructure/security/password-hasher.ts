import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP argon2id params; retune so one hash takes 250-500 ms. */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private dummyHash: string | undefined;

  /** Eager, so the first unknown-email login isn't slower than later ones. */
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash('dummy-password-for-timing');
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }

  /** Burns a real verify so a missing user costs the same as a wrong password. */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= await this.hash('dummy-password-for-timing');
    await this.verify(this.dummyHash, plain);
  }
}
