import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import type { CreateUserInput } from './dto/create-user.dto';
import type { CursorPayload } from './users.cursor';
import type { CursorPage } from './users.repository';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repo: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

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
    this.logger.log({ userId: user.id, role: user.role }, 'user created');
    return user;
  }

  findActiveById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  /** Admins see anyone; others only themselves. 404 (not 403) avoids user enumeration. */
  async findVisibleTo(id: string, actor: AuthUser): Promise<User> {
    const user = actor.role === 'admin' || actor.id === id ? await this.repo.findById(id) : null;
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  list(cursor: CursorPayload | undefined, limit: number): Promise<CursorPage<User>> {
    return this.repo.listPage(cursor, limit);
  }

  async softDelete(id: string): Promise<void> {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundException('user not found');
  }
}
