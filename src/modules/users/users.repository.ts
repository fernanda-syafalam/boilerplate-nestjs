import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../infrastructure/database/drizzle.service';
import { type NewUser, type User, users } from '../../infrastructure/database/schema/users.schema';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface CursorPayload {
  id: string;
  createdAt: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async create(input: NewUser): Promise<User> {
    const [row] = await this.db.insert(users).values(input).returning();
    if (!row) {
      throw new Error('users.insert returned no row');
    }
    return row;
  }

  /** The (createdAt, id) tie-break keeps order stable. */
  async listPage(cursor: string | undefined, limit: number): Promise<CursorPage<User>> {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const cursorPredicate = decoded
      ? or(
          lt(users.createdAt, new Date(decoded.createdAt)),
          and(eq(users.createdAt, new Date(decoded.createdAt)), lt(users.id, decoded.id)),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(users)
      .where(and(isNull(users.deletedAt), cursorPredicate))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const hasMore = rows.length > limit;
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.db
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (result.rowCount === 0) {
      throw new NotFoundException('user not found');
    }
  }
}

function encodeCursor(u: Pick<User, 'id' | 'createdAt'>): string {
  const payload: CursorPayload = {
    id: u.id,
    createdAt: u.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(s: string): CursorPayload {
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as CursorPayload;
}
