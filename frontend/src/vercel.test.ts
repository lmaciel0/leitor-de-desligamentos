import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Cabecalho { key: string; value: string }
interface ConfigVercel { headers: { source: string; headers: Cabecalho[] }[] }

function csp(): string {
  const arquivo = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const config = JSON.parse(readFileSync(arquivo, 'utf-8')) as ConfigVercel;
  const cabecalho = config.headers.flatMap((regra) => regra.headers).find((h) => h.key === 'Content-Security-Policy');
  if (!cabecalho) throw new Error('vercel.json sem Content-Security-Policy');
  return cabecalho.value;
}

describe('vercel.json', () => {
  it('só permite conexões para a própria origem', () => {
    expect(csp()).toMatch(/connect-src 'self'(;|$)/);
  });

  it('não libera nenhum host externo em nenhuma diretiva', () => {
    expect(csp()).not.toMatch(/https?:\/\//);
  });

  it('permite o worker do pdf.js da própria origem', () => {
    expect(csp()).toMatch(/worker-src 'self'/);
  });
});
