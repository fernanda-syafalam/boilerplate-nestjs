import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../infrastructure/database/schema/users.schema';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let repo: {
    findActiveByEmail: ReturnType<typeof vi.fn>;
    findActiveById: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let refresh: {
    mint: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  const password = 'correct-horse-battery-staple';
  let user: User;

  beforeEach(async () => {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'a@b.test',
      fullName: 'A',
      passwordHash,
      role: 'customer',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    repo = { findActiveByEmail: vi.fn(), findActiveById: vi.fn() };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.value') };
    refresh = {
      mint: vi.fn().mockResolvedValue({ token: 'refresh-A', expiresInSeconds: 604_800 }),
      consume: vi.fn(),
      revoke: vi.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordHasher,
        { provide: UsersService, useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: RefreshTokenService, useValue: refresh },
        { provide: PinoLogger, useValue: { warn: vi.fn(), setContext: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns access + refresh token pair on valid credentials', async () => {
      repo.findActiveByEmail.mockResolvedValue(user);
      const out = await service.login(user.email, password);
      expect(out.accessToken).toBe('signed.jwt.value');
      expect(out.refreshToken).toBe('refresh-A');
      expect(out.refreshExpiresInSeconds).toBe(604_800);
      expect(out.user).toEqual({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: user.id });
      expect(refresh.mint).toHaveBeenCalledWith(user.id);
    });

    it('rejects with 401 when email is unknown', async () => {
      repo.findActiveByEmail.mockResolvedValue(null);
      await expect(service.login('nope@b.test', password)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(refresh.mint).not.toHaveBeenCalled();
    });

    it('rejects with 401 when password does not match', async () => {
      repo.findActiveByEmail.mockResolvedValue(user);
      await expect(service.login(user.email, 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(refresh.mint).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('consumes the refresh token and returns a fresh pair', async () => {
      refresh.consume.mockResolvedValue(user.id);
      refresh.mint.mockResolvedValue({
        token: 'refresh-B',
        expiresInSeconds: 604_800,
      });
      repo.findActiveById.mockResolvedValue(user);

      const out = await service.refresh('refresh-A');

      expect(refresh.consume).toHaveBeenCalledWith('refresh-A');
      expect(out.refreshToken).toBe('refresh-B');
      expect(out.accessToken).toBe('signed.jwt.value');
      expect(out.user.id).toBe(user.id);
    });

    it('rejects with 401 and mints nothing when the user no longer exists', async () => {
      refresh.consume.mockResolvedValue(user.id);
      repo.findActiveById.mockResolvedValue(null);

      await expect(service.refresh('refresh-A')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refresh.mint).not.toHaveBeenCalled();
    });

    it('lets RefreshTokenService.consume raise (unknown / replayed token)', async () => {
      refresh.consume.mockRejectedValue(new UnauthorizedException('invalid refresh token'));
      await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the supplied refresh token', async () => {
      await service.logout('refresh-Z');
      expect(refresh.revoke).toHaveBeenCalledWith('refresh-Z');
    });
  });
});
