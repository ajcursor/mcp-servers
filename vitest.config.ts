import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'servers/*/test/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
