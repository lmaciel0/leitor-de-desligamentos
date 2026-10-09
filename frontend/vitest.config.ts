import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // O build moderno do pdf.js avisa e falha no Node; os testes usam o build legacy.
    alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/testes/setup.ts'],
  },
});
