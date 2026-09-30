import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { encodeCursor } from './users.cursor';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const sampleUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'a@b.test',
  fullName: 'A B',
  passwordHash: '$argon2id$v=19$...',
  role: 'customer',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};

describe('UsersService', () => {
  let service: UsersService;
  let hasher: { hash: ReturnType<typeof vi.fn> };
  let repo: {
    findActiveById: ReturnType<typeof vi.fn>;
    findActiveByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    listPage: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    hasher = { hash: vi.fn().mockResolvedValue('hashed-by-hasher') };
    repo = {
      findActiveById: vi.fn(),
      findActiveByEmail: vi.fn(),
      create: vi.fn(),
      listPage: vi.fn(),
      softDelete: vi.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PasswordHasher, useValue: hasher },
        { provide: UsersRepository, useValue: repo },
        { provide: PinoLogger, useValue: { info: vi.fn(), setContext: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('hashes the password and inserts a new user', async () => {
      repo.create.mockResolvedValue(sampleUser);

      const created = await service.create({
        email: 'a@b.test',
        fullName: 'A B',
        password: 'correct horse battery staple',
      });

      expect(created).toEqual(sampleUser);
      expect(repo.create).toHaveBeenCalledTimes(1);
      const call = repo.create.mock.calls[0]?.[0];
      expect(hasher.hash).toHaveBeenCalledWith('correct horse battery staple');
      expect(call?.passwordHash).toBe('hashed-by-hasher');
      expect(call?.role).toBe('customer');
    });

    it('rejects when email is already taken', async () => {
      repo.create.mockResolvedValue(null);
      await expect(
        service.create({
          email: sampleUser.email,
          fullName: 'X',
          password: 'a-fresh-password-here',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findVisibleTo', () => {
    const actor = (id: string, role: 'admin' | 'customer') => ({
      id,
      email: 'x@y.test',
      fullName: 'X',
      role,
    });

    it('lets a user read themself', async () => {
      repo.findActiveById.mockResolvedValue(sampleUser);
      await expect(
        service.findVisibleTo(sampleUser.id, actor(sampleUser.id, 'customer')),
      ).resolves.toBe(sampleUser);
    });

    it('lets an admin read anyone', async () => {
      repo.findActiveById.mockResolvedValue(sampleUser);
      await expect(service.findVisibleTo(sampleUser.id, actor('other', 'admin'))).resolves.toBe(
        sampleUser,
      );
    });

    it('404s for another non-admin without touching the repo', async () => {
      await expect(
        service.findVisibleTo(sampleUser.id, actor('other', 'customer')),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findActiveById).not.toHaveBeenCalled();
    });

    it('404s when the user is missing', async () => {
      repo.findActiveById.mockResolvedValue(null);
      await expect(service.findVisibleTo('gone', actor('gone', 'customer'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('404s when nothing was deleted', async () => {
      repo.softDelete.mockResolvedValue(false);
      await expect(service.softDelete('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    const second: User = { ...sampleUser, id: '00000000-0000-4000-8000-000000000002' };

    it('builds nextCursor from the last returned item when more rows exist', async () => {
      repo.listPage.mockResolvedValue({ items: [sampleUser, second], hasMore: true });

      const page = await service.list(undefined, 2);

      expect(repo.listPage).toHaveBeenCalledWith(undefined, 2);
      expect(page.items).toEqual([sampleUser, second]);
      expect(page.nextCursor).toBe(encodeCursor(second));
    });

    it('returns a null cursor on the last page', async () => {
      repo.listPage.mockResolvedValue({ items: [sampleUser], hasMore: false });

      const page = await service.list(undefined, 2);

      expect(page.nextCursor).toBeNull();
    });
  });
});
