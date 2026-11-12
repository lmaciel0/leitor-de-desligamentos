import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// O preview (usado pelos testes no navegador) serve os mesmos cabeçalhos de segurança da Vercel,
// para o app ser testado sob o CSP real. Fonte única: vercel.json. Cada regra vale só para os
// caminhos que seu `source` casa, como na Vercel (ex.: /ocr/ tem um CSP próprio).
interface RegraVercel {
  source: string;
  headers: { key: string; value: string }[];
}
interface ConfigVercel {
  headers: RegraVercel[];
}
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8')) as ConfigVercel;
const regras = vercel.headers.map((regra) => ({ ...regra, padrao: new RegExp('^' + regra.source + '$') }));

function cabecalhosDaVercel(): Plugin {
  return {
    name: 'cabecalhos-da-vercel',
    configurePreviewServer(servidor) {
      servidor.middlewares.use((req, res, next) => {
        const caminho = (req.url ?? '/').split('?')[0] ?? '/';
        for (const regra of regras) {
          if (!regra.padrao.test(caminho)) continue;
          for (const { key, value } of regra.headers) res.setHeader(key, value);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cabecalhosDaVercel()],
  server: { port: 5173 },
  build: {
    // O único chunk acima de 500 kB é o pdfjs, carregado sob demanda por src/lib/pdf/carregarPdfjs.ts.
    // O limite fica logo acima dele para um chunk novo e grande ainda avisar.
    chunkSizeWarningLimit: 600,
  },
});
