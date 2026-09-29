import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '../../infrastructure/database/schema/users.schema';
import type { CreateUserInput } from './dto/create-user.dto';
import type { CursorPage } from './users.repository';
import { UsersRepository } from './users.repository';

/** OWASP argon2id params; retune so one hash takes 250-500 ms. */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly repo: UsersRepository) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('email already in use');
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const user = await this.repo.create({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      role: input.role,
    });
    this.logger.log({ userId: user.id, role: user.role }, 'user created');
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async list(cursor: string | undefined, limit: number): Promise<CursorPage<User>> {
    return this.repo.listPage(cursor, limit);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
