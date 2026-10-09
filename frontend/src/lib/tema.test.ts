// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, salvarTema, temaDoSistema, temaInicial, temaSalvo } from './tema';

function sistemaEscuro(escuro: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: escuro && consulta.includes('dark') }));
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('temaSalvo', () => {
  it('devolve null quando nada foi salvo ou o valor é inválido', () => {
    expect(temaSalvo()).toBeNull();
    window.localStorage.setItem('tema', 'roxo');
    expect(temaSalvo()).toBeNull();
  });

  it('devolve o tema salvo', () => {
    window.localStorage.setItem('tema', 'escuro');
    expect(temaSalvo()).toBe('escuro');
    window.localStorage.setItem('tema', 'claro');
    expect(temaSalvo()).toBe('claro');
  });

  it('devolve null quando o armazenamento do navegador está indisponível', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(temaSalvo()).toBeNull();
  });
});

describe('temaDoSistema', () => {
  it('segue a preferência de cores do sistema', () => {
    sistemaEscuro(true);
    expect(temaDoSistema()).toBe('escuro');
    sistemaEscuro(false);
    expect(temaDoSistema()).toBe('claro');
  });

  it('usa o claro quando o navegador não sabe responder à consulta', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(temaDoSistema()).toBe('claro');
  });
});

describe('temaInicial', () => {
  it('a escolha salva vale mais que a preferência do sistema', () => {
    sistemaEscuro(true);
    window.localStorage.setItem('tema', 'claro');
    expect(temaInicial()).toBe('claro');
  });

  it('sem escolha salva, segue o sistema', () => {
    sistemaEscuro(true);
    expect(temaInicial()).toBe('escuro');
  });
});

describe('salvarTema e aplicarTema', () => {
  it('salva a escolha', () => {
    salvarTema('escuro');
    expect(window.localStorage.getItem('tema')).toBe('escuro');
  });

  it('não quebra quando o armazenamento não aceita gravação', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio');
    });
    expect(() => salvarTema('escuro')).not.toThrow();
  });

  it('o tema escuro liga a classe "dark" e o color-scheme escuro; o claro desliga', () => {
    aplicarTema('escuro');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    aplicarTema('claro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
