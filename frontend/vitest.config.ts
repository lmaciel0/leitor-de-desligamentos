import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Os testes no navegador (e2e/) rodam pelo Playwright, não pelo Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/testes/setup.ts'],
  },
});
