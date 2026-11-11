// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContagem } from './contagem';

function movimentoReduzido(reduzido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reduzido && consulta.includes('prefers-reduced-motion'),
  }));
}

describe('useContagem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    movimentoReduzido(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('com chave nova, parte de 0 e chega ao alvo ao fim da duração', () => {
    const { result } = renderHook(() => useContagem(42, 1, 600));
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(42);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);
  });

  it('com a mesma chave, só o alvo mudando, vai direto ao novo valor', () => {
    const { result, rerender } = renderHook(({ alvo }) => useContagem(alvo, 1, 600), { initialProps: { alvo: 42 } });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(42);
    rerender({ alvo: 41 });
    expect(result.current).toBe(41);
  });

  it('o alvo mudando no meio da animação cancela a animação e vai direto', () => {
    const { result, rerender } = renderHook(({ alvo }) => useContagem(alvo, 1, 600), { initialProps: { alvo: 42 } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ alvo: 10 });
    expect(result.current).toBe(10);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(10);
  });

  it('uma chave nova depois de pronto anima de novo a partir de 0', () => {
    const { result, rerender } = renderHook(({ chave }) => useContagem(42, chave, 600), { initialProps: { chave: 1 } });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    rerender({ chave: 2 });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(42);
  });

  it('com prefers-reduced-motion devolve o alvo de cara e não agenda quadros', () => {
    movimentoReduzido(true);
    const pedido = vi.spyOn(window, 'requestAnimationFrame');
    const { result } = renderHook(() => useContagem(42, 1, 600));
    expect(result.current).toBe(42);
    expect(pedido).not.toHaveBeenCalled();
  });

  it('cancela o quadro pendente ao desmontar', () => {
    const cancelar = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useContagem(42, 1, 600));
    unmount();
    expect(cancelar).toHaveBeenCalled();
  });
});
