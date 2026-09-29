import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../infrastructure/database/drizzle.service';
import { type NewUser, type User, users } from '../../infrastructure/database/schema/users.schema';
import { type CursorPayload, encodeCursor } from './users.cursor';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
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

  /** Null when the email is taken (soft-deleted rows keep their email). */
  async create(input: NewUser): Promise<User | null> {
    const [row] = await this.db
      .insert(users)
      .values(input)
      .onConflictDoNothing({ target: users.email })
      .returning();
    return row ?? null;
  }

  /** The (createdAt, id) tie-break keeps order stable. */
  async listPage(cursor: CursorPayload | undefined, limit: number): Promise<CursorPage<User>> {
    const cursorPredicate = cursor
      ? or(
          lt(users.createdAt, new Date(cursor.createdAt)),
          and(eq(users.createdAt, new Date(cursor.createdAt)), lt(users.id, cursor.id)),
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

  /** False when no active user matched. */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return (result.rowCount ?? 0) > 0;
  }
}
