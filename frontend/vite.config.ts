import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O preview (usado pelos testes no navegador) serve os mesmos cabeçalhos de segurança da Vercel,
// para o app ser testado sob o CSP real. Fonte única: vercel.json.
interface ConfigVercel {
  headers: { headers: { key: string; value: string }[] }[];
}
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8')) as ConfigVercel;
const cabecalhos = Object.fromEntries(vercel.headers.flatMap((regra) => regra.headers).map((h) => [h.key, h.value]));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { headers: cabecalhos },
});
