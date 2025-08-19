import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'unit',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', 'src/e2e/**/*'],
    testTimeout: 5000,
    hookTimeout: 5000,
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
      '@mocks': path.resolve(__dirname, './src/testing/mocks'),
      '@filecoin-plus/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
