import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate, slower project: exercises the real card-database-test artifact
// instead of the small in-memory fixture used by the default `npm test` run.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.integration.test.{ts,tsx}'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
