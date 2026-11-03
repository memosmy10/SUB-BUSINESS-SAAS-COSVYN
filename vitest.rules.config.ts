import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/firestore-rules.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
