import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Each spec opens its own `:memory:` SQLite connection; no shared state,
    // no cleanup step, and no test can see another's replay ledger.
    restoreMocks: true,
  },
  esbuild: {
    target: 'es2022',
  },
});
