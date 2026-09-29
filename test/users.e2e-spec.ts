import fastifyCookie from '@fastify/cookie';
import { VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/infrastructure/database/drizzle.service';
import type { NewUser, User } from '../src/infrastructure/database/schema/users.schema';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { inMemoryThrottler } from './support/in-memory-throttler';

const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const ALICE_ID = '00000000-0000-4000-8000-0000000000b1';
const BOB_ID = '00000000-0000-4000-8000-0000000000b2';

function makeUser(id: string, email: string, role: User['role']): User {
  return {
    id,
    email,
    fullName: email,
    passwordHash: 'stored-hash',
    role,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  };
}

class FakeUsersRepository {
  readonly rows = new Map<string, User>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string) {
    return [...this.rows.values()].find((u) => u.email === email) ?? null;
  }

  async create(input: NewUser) {
    if (await this.findByEmail(input.email)) return null;
    const user: User = {
      ...makeUser(crypto.randomUUID(), input.email, input.role ?? 'customer'),
      fullName: input.fullName,
      passwordHash: input.passwordHash,
    };
    this.rows.set(user.id, user);
    return user;
  }

  async listPage() {
    return { items: [...this.rows.values()], nextCursor: null };
  }

  async softDelete(id: string) {
    return this.rows.has(id);
  }
}

describe('Users (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let aliceToken: string;

  beforeAll(async () => {
    const repo = new FakeUsersRepository();
    for (const u of [
      makeUser(ADMIN_ID, 'admin@b.test', 'admin'),
      makeUser(ALICE_ID, 'alice@b.test', 'customer'),
      makeUser(BOB_ID, 'bob@b.test', 'customer'),
    ]) {
      repo.rows.set(u.id, u);
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(inMemoryThrottler.token)
      .useValue(inMemoryThrottler.options)
      .overrideProvider(DrizzleService)
      .useValue({
        ping: async () => true,
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
      .overrideProvider(RedisService)
      .useValue({
        client: { call: async () => null },
        ping: async () => true,
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
      .overrideProvider(UsersRepository)
      .useValue(repo)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0]);
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const jwt = app.get(JwtService);
    adminToken = await jwt.signAsync({ sub: ADMIN_ID, role: 'admin' });
    aliceToken = await jwt.signAsync({ sub: ALICE_ID, role: 'customer' });
  });

  afterAll(async () => {
    await app.close();
  });

  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
  const signup = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/v1/users', payload });
  const validSignup = {
    email: 'New@B.test',
    fullName: 'New',
    password: 'a-long-enough-password',
  };

  it('POST rejects a client-supplied role with 400', async () => {
    const res = await signup({ ...validSignup, role: 'admin' });
    expect(res.statusCode).toBe(400);
  });

  it('POST creates a customer and never returns passwordHash', async () => {
    const res = await signup(validSignup);
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, unknown>;
    expect(body.role).toBe('customer');
    expect(body.email).toBe('new@b.test');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('POST with an existing email returns 409', async () => {
    const res = await signup({ ...validSignup, email: 'alice@b.test' });
    expect(res.statusCode).toBe(409);
  });

  it('GET list as customer is 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: bearer(aliceToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET list as admin is 200 without passwordHash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<Record<string, unknown>> };
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) expect(item).not.toHaveProperty('passwordHash');
  });

  it('GET list with a garbage cursor is 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?cursor=not-a-real-cursor',
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET :id returns self for a customer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${ALICE_ID}`,
      headers: bearer(aliceToken),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { id: string }).id).toBe(ALICE_ID);
  });

  it('GET :id of another user is 404 for a customer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${BOB_ID}`,
      headers: bearer(aliceToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET :id of another user is 200 for an admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${BOB_ID}`,
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET :id with a non-uuid is 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/not-a-uuid',
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE :id as admin returns 204 for an existing user', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${BOB_ID}`,
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE :id as admin returns 404 for a missing user', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/users/00000000-0000-4000-8000-0000000000ff',
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE :id as customer is 403', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${BOB_ID}`,
      headers: bearer(aliceToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('DELETE :id with a non-uuid is 400', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/users/not-a-uuid',
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(400);
  });
});
