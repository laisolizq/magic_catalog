import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Integration tests run separately via vitest.integration.config.ts (npm run test:integration).
    exclude: ['**/node_modules/**', '**/*.integration.test.{ts,tsx}'],
  },
})
