// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Caminho relativo a este arquivo (e não ao diretório atual), com a string de import.meta.url:
// no ambiente jsdom, o URL global é o do jsdom e o fileURLToPath do Node o recusa.
const codigo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'compat.js'), 'utf-8');
const executar = () => new Function(codigo)();
const janela = window as Window & { __navegadorIncompativel?: boolean };

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  delete janela.__navegadorIncompativel;
  // O jsdom não tem Worker nem noModule; nos testes, o navegador "completo" tem.
  vi.stubGlobal('Worker', function Worker() {});
  Object.defineProperty(HTMLScriptElement.prototype, 'noModule', { value: false, configurable: true, writable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLScriptElement.prototype as { noModule?: boolean }).noModule;
});

it('sem suporte a módulos JavaScript, avisa (é o caso dos navegadores mais antigos)', () => {
  delete (HTMLScriptElement.prototype as { noModule?: boolean }).noModule;
  executar();
  expect(janela.__navegadorIncompativel).toBe(true);
  expect(document.getElementById('root')!.textContent).toContain('módulos JavaScript');
});

describe('compat.js (aviso de navegador antigo)', () => {
  it('não faz nada quando o navegador tem tudo o que o app usa', () => {
    executar();
    expect(janela.__navegadorIncompativel).toBeUndefined();
    expect(document.getElementById('root')!.textContent).toBe('');
  });

  it('sem Web Workers, mostra o aviso e marca a página como incompatível', () => {
    vi.stubGlobal('Worker', undefined);
    executar();
    expect(janela.__navegadorIncompativel).toBe(true);
    const texto = document.getElementById('root')!.textContent ?? '';
    expect(texto).toContain('Este navegador é antigo demais');
    expect(texto).toContain('Atualize o Google Chrome ou o Microsoft Edge');
  });

  it('sem criptografia do navegador (crypto.subtle), também avisa', () => {
    vi.stubGlobal('crypto', {});
    executar();
    expect(janela.__navegadorIncompativel).toBe(true);
  });

  it('o aviso é texto puro, sem HTML montado a partir de strings', () => {
    vi.stubGlobal('Worker', undefined);
    executar();
    expect(codigo).not.toContain('innerHTML');
    expect(document.querySelector('#root [role="alert"]')).not.toBeNull();
  });
});
