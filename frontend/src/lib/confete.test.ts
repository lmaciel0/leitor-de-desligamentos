// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const disparo = vi.fn();
const create = vi.fn<(canvas: unknown, opcoes: unknown) => typeof disparo>(() => disparo);
vi.mock('canvas-confetti', () => ({ default: { create } }));

function movimentoReduzido(reduzido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: reduzido && consulta.includes('reduced-motion') }));
}

/** O disparo carrega a biblioteca por import dinâmico: espera a fila de promessas esvaziar. */
const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetModules();
  create.mockClear();
  disparo.mockClear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('soltarConfete', () => {
  it('com movimento reduzido não cria o canvas nem carrega a biblioteca', async () => {
    movimentoReduzido(true);
    const { soltarConfete } = await import('./confete');
    soltarConfete();
    await esperar();
    expect(create).not.toHaveBeenCalled();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('cria o canvas e a instância uma vez só, sem worker, e dispara a cada chamada', async () => {
    movimentoReduzido(false);
    const { soltarConfete } = await import('./confete');
    soltarConfete();
    soltarConfete();
    await esperar();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toMatchObject({ resize: true, useWorker: false, disableForReducedMotion: true });
    expect(disparo).toHaveBeenCalledTimes(2);
    expect(disparo).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.3 },
        colors: ['#FF6B5B', '#14213D', '#F4EDE0', '#FFB3A9'],
      }),
    );
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('o canvas é decorativo: escondido de leitor de tela, sem capturar o ponteiro, acima do conteúdo', async () => {
    movimentoReduzido(false);
    const { soltarConfete } = await import('./confete');
    soltarConfete();
    await esperar();
    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas?.style.pointerEvents).toBe('none');
    expect(canvas?.style.position).toBe('fixed');
    expect(Number(canvas?.style.zIndex)).toBeGreaterThanOrEqual(100);
    expect(create.mock.calls[0]?.[0]).toBe(canvas);
  });
});
