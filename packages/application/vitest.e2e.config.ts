import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'e2e',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/e2e/**/*.e2e.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
      '@mocks': path.resolve(__dirname, './src/testing/mocks'),
      '@e2e': path.resolve(__dirname, './src/e2e'),
      '@filecoin-plus/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
