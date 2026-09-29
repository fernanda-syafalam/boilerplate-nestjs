import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // SWC keeps NestJS decorator metadata working in tests without ts-jest.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Need Docker; run with `pnpm test:int`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int-spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        '**/*.int-spec.ts',
        '**/main.ts',
        '**/*.module.ts',
        '**/*.dto.ts',
        // Covered by `pnpm test:int` (Testcontainers).
        '**/*.repository.ts',
        '**/infrastructure/database/drizzle.service.ts',
        'drizzle.config.ts',
        'vitest.config.ts',
        'vitest.int.config.ts',
        'dist/**',
        'coverage/**',
      ],
      // Raise toward 80% lines as business logic grows.
      thresholds: {
        lines: 70,
        functions: 50,
        branches: 70,
        statements: 70,
      },
    },
  },
});
