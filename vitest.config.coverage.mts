import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        lines: 80,
        functions: 80,
      },
    },
  },
});
