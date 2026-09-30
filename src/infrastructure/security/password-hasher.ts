import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

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

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(PasswordHasher.name);
  }

  /** Eager, so the first unknown-email login isn't slower than later ones. */
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash('dummy-password-for-timing');
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch (error) {
      // TypeError = argon2/phc parse failure of the stored hash; anything else is a real
      // failure that must not read as a wrong password.
      if (!(error instanceof TypeError)) throw error;
      this.logger.warn('stored password hash is malformed');
      return false;
    }
  }

  /** Burns a real verify so a missing user costs the same as a wrong password. */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= await this.hash('dummy-password-for-timing');
    await this.verify(this.dummyHash, plain);
  }
}
