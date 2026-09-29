import 'reflect-metadata';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-secret-must-be-at-least-32-characters-long';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.THROTTLER_LIMIT = process.env.THROTTLER_LIMIT ?? '1000000';
