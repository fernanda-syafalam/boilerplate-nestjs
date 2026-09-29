import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { AuthUser } from '../../common/types/auth-user';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import type { CreateUserInput } from './dto/create-user.dto';
import { type CursorPayload, encodeCursor } from './users.cursor';
import { UsersRepository } from './users.repository';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsersService.name);
  }

  /** Public signup: role is never client-controlled. */
  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.repo.create({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      role: 'customer',
    });
    if (!user) throw new ConflictException('email already in use');
    this.logger.info({ userId: user.id, role: user.role }, 'user created');
    return user;
  }

  findActiveById(id: string): Promise<User | null> {
    return this.repo.findActiveById(id);
  }

  findActiveByEmail(email: string): Promise<User | null> {
    return this.repo.findActiveByEmail(email);
  }

  /** Admins see anyone; others only themselves. 404 (not 403) avoids user enumeration. */
  async findVisibleTo(id: string, actor: AuthUser): Promise<User> {
    const user =
      actor.role === 'admin' || actor.id === id ? await this.repo.findActiveById(id) : null;
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async list(cursor: CursorPayload | undefined, limit: number): Promise<CursorPage<User>> {
    const { items, hasMore } = await this.repo.listPage(cursor, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
  }

  async softDelete(id: string): Promise<void> {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundException('user not found');
  }
}
