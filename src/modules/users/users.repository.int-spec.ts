import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Db, DrizzleService } from '../../infrastructure/database/drizzle.service';
import * as schema from '../../infrastructure/database/schema';
import { type NewUser, users } from '../../infrastructure/database/schema/users.schema';
import { UsersRepository } from './users.repository';

describe('UsersRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Db;
  let repo: UsersRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle(pool, { schema });

    // The committed migrations, so this test also catches drift between them and the schema.
    await migrate(db, { migrationsFolder: resolve(__dirname, '../../../drizzle') });

    const drizzleStub = { db } as Pick<DrizzleService, 'db'>;
    repo = new UsersRepository(drizzleStub as DrizzleService);
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function createOrFail(input: NewUser) {
    const row = await repo.create(input);
    if (!row) throw new Error('unexpected email conflict');
    return row;
  }

  beforeEach(async () => {
    await db.delete(users);
  });

  it('creates and reads back by id and email', async () => {
    const created = await createOrFail({
      email: 'a@b.test',
      fullName: 'A B',
      passwordHash: 'hash',
    });

    const byId = await repo.findActiveById(created.id);
    const byEmail = await repo.findActiveByEmail('a@b.test');

    expect(byId?.id).toBe(created.id);
    expect(byEmail?.id).toBe(created.id);
  });

  it('create returns null on a duplicate email, including a soft-deleted one', async () => {
    const first = await createOrFail({ email: 'dup@b.test', fullName: 'D', passwordHash: 'hash' });
    expect(
      await repo.create({ email: 'dup@b.test', fullName: 'D2', passwordHash: 'h' }),
    ).toBeNull();
    await repo.softDelete(first.id);
    expect(
      await repo.create({ email: 'dup@b.test', fullName: 'D3', passwordHash: 'h' }),
    ).toBeNull();
  });

  it('soft delete hides the row from finders', async () => {
    const created = await createOrFail({
      email: 'sd@b.test',
      fullName: 'Soft Delete',
      passwordHash: 'hash',
    });

    expect(await repo.softDelete(created.id)).toBe(true);
    expect(await repo.softDelete(created.id)).toBe(false);

    expect(await repo.findActiveById(created.id)).toBeNull();
    expect(await repo.findActiveByEmail('sd@b.test')).toBeNull();
  });

  it('lists with stable cursor pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await createOrFail({
        email: `u${i}@b.test`,
        fullName: `User ${i}`,
        passwordHash: 'hash',
      });
    }

    const page1 = await repo.listPage(undefined, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);

    const last1 = page1.items[1];
    const page2 = await repo.listPage(last1, 2);
    expect(page2.items).toHaveLength(2);

    const page1Ids = new Set(page1.items.map((u) => u.id));
    expect(page2.items.every((u) => !page1Ids.has(u.id))).toBe(true);

    const last2 = page2.items[1];
    const page3 = await repo.listPage(last2, 2);
    expect(page3.items).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });
});
