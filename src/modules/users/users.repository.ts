import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../infrastructure/database/drizzle.service';
import { type NewUser, type User, users } from '../../infrastructure/database/schema/users.schema';

@Injectable()
export class UsersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db;
  }

  async findActiveById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findActiveByEmail(email: string): Promise<User | null> {
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
  async listPage(
    cursor: { id: string; createdAt: Date } | undefined,
    limit: number,
  ): Promise<{ items: User[]; hasMore: boolean }> {
    const cursorPredicate = cursor
      ? or(
          lt(users.createdAt, cursor.createdAt),
          and(eq(users.createdAt, cursor.createdAt), lt(users.id, cursor.id)),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(users)
      .where(and(isNull(users.deletedAt), cursorPredicate))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit + 1);

    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return (result.rowCount ?? 0) > 0;
  }
}
