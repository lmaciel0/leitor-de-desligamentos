import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Cabecalho { key: string; value: string }
interface ConfigVercel { headers: { source: string; headers: Cabecalho[] }[] }

function cabecalho(nome: string): string {
  const arquivo = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const config = JSON.parse(readFileSync(arquivo, 'utf-8')) as ConfigVercel;
  const encontrado = config.headers.flatMap((regra) => regra.headers).find((h) => h.key === nome);
  if (!encontrado) throw new Error(`vercel.json sem ${nome}`);
  return encontrado.value;
}

const csp = () => cabecalho('Content-Security-Policy');

describe('vercel.json: endurecimento', () => {
  it('não libera blob: para workers nem imagens (o worker do pdf.js é um arquivo do próprio site)', () => {
    expect(csp()).toMatch(/worker-src 'self'(;|$)/);
    expect(csp()).not.toContain('blob:');
  });

  it('estilos só do próprio site; unsafe-inline apenas para atributos style', () => {
    expect(csp()).toMatch(/style-src 'self'(;|$)/);
    expect(csp()).toMatch(/style-src-attr 'unsafe-inline'(;|$)/);
  });

  it('desliga câmera, microfone, localização e afins', () => {
    const politica = cabecalho('Permissions-Policy');
    for (const recurso of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(politica).toContain(`${recurso}=()`);
    }
  });

  it('isola a janela de outras origens', () => {
    expect(cabecalho('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });
});

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

describe('vercel.json: regra do OCR', () => {
  const arquivo = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const regras = () => (JSON.parse(readFileSync(arquivo, 'utf-8')) as ConfigVercel).headers;
  const cspDe = (source: string): string => {
    const regra = regras().find((r) => r.source === source);
    if (!regra) throw new Error(`vercel.json sem regra ${source}`);
    const valor = regra.headers.find((h) => h.key === 'Content-Security-Policy');
    if (!valor) throw new Error(`regra ${source} sem CSP`);
    return valor.value;
  };
  const cspGlobal = () => cspDe('/((?!ocr/).*)');
  const cspOcr = () => cspDe('/ocr/(.*)');

  it("o CSP de /ocr/ é o global, exceto por script-src 'self' 'wasm-unsafe-eval'", () => {
    expect(cspOcr()).toBe(cspGlobal().replace("script-src 'self';", "script-src 'self' 'wasm-unsafe-eval';"));
    expect(cspOcr()).not.toBe(cspGlobal());
  });

  it('wasm-unsafe-eval fica de fora da regra global', () => {
    expect(cspGlobal()).not.toContain('wasm-unsafe-eval');
    expect(cspGlobal()).toMatch(/script-src 'self'(;|$)/);
  });

  it('a regra do OCR mantém os demais cabeçalhos da global', () => {
    const outros = (source: string) => regras().find((r) => r.source === source)?.headers.filter((h) => h.key !== 'Content-Security-Policy');
    expect(outros('/ocr/(.*)')).toEqual(outros('/((?!ocr/).*)'));
    expect(outros('/ocr/(.*)')).toHaveLength(4);
  });

  it("o CSP de /ocr/ segue sem blob:, sem hosts externos, com connect-src e worker-src 'self'", () => {
    expect(cspOcr()).not.toContain('blob:');
    expect(cspOcr()).not.toMatch(/https?:\/\//);
    expect(cspOcr()).toMatch(/connect-src 'self'(;|$)/);
    expect(cspOcr()).toMatch(/worker-src 'self'(;|$)/);
  });
});
