import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
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
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    listPage: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      listPage: vi.fn(),
      softDelete: vi.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PasswordHasher, { provide: UsersRepository, useValue: repo }],
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
      expect(call?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(call?.passwordHash).not.toContain('correct horse');
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
      repo.findById.mockResolvedValue(sampleUser);
      await expect(
        service.findVisibleTo(sampleUser.id, actor(sampleUser.id, 'customer')),
      ).resolves.toBe(sampleUser);
    });

    it('lets an admin read anyone', async () => {
      repo.findById.mockResolvedValue(sampleUser);
      await expect(service.findVisibleTo(sampleUser.id, actor('other', 'admin'))).resolves.toBe(
        sampleUser,
      );
    });

    it('404s for another non-admin without touching the repo', async () => {
      await expect(
        service.findVisibleTo(sampleUser.id, actor('other', 'customer')),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('404s when the user is missing', async () => {
      repo.findById.mockResolvedValue(null);
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

  describe('hash compatibility', () => {
    // Verifies the argon2 binding and params produce a verifiable hash.
    it('produces a hash that argon2.verify accepts', async () => {
      repo.create.mockImplementation(async (input) => ({
        ...sampleUser,
        ...input,
      }));

      const created = await service.create({
        email: 'verify@test',
        fullName: 'V',
        password: 'another-secret-pass-9',
      });

      const ok = await argon2.verify(created.passwordHash, 'another-secret-pass-9');
      expect(ok).toBe(true);
    });
  });
});
