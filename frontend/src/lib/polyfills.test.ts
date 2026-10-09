import { describe, expect, it, vi } from 'vitest';

type Resolvers<T> = { promise: Promise<T>; resolve: (valor: T) => void; reject: (motivo?: unknown) => void };
const P = Promise as unknown as {
  withResolvers?: <T>() => Resolvers<T>;
  try?: <T>(fn: () => T) => Promise<T>;
};
const U = URL as unknown as { parse?: (url: string, base?: string) => URL | null };
const S = AbortSignal as unknown as { any?: (sinais: AbortSignal[]) => AbortSignal };

/** Simula um navegador sem as APIs recentes que o pdf.js usa e carrega os polyfills do zero. */
async function carregarSem(apagar: () => void) {
  apagar();
  vi.resetModules();
  await import('./polyfills');
}

describe('polyfills para navegadores antigos', () => {
  it('Promise.withResolvers volta a existir e funciona', async () => {
    await carregarSem(() => delete P.withResolvers);
    const { promise, resolve } = P.withResolvers!<number>();
    resolve(7);
    await expect(promise).resolves.toBe(7);
  });

  it('Promise.try volta a existir e captura erros síncronos', async () => {
    await carregarSem(() => delete P.try);
    await expect(P.try!(() => 3)).resolves.toBe(3);
    await expect(
      P.try!(() => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
  });

  it('URL.parse volta a existir e devolve null para endereço inválido', async () => {
    await carregarSem(() => delete U.parse);
    expect(U.parse!('https://exemplo.org/a')?.pathname).toBe('/a');
    expect(U.parse!('não é url')).toBeNull();
  });

  it('AbortSignal.any volta a existir e aborta quando qualquer sinal abortar', async () => {
    await carregarSem(() => delete S.any);
    const a = new AbortController();
    const b = new AbortController();
    const combinado = S.any!([a.signal, b.signal]);
    expect(combinado.aborted).toBe(false);
    b.abort('motivo');
    expect(combinado.aborted).toBe(true);
    expect(combinado.reason).toBe('motivo');
  });

  it('não substitui uma implementação nativa que já existe', async () => {
    const original = P.withResolvers;
    vi.resetModules();
    await import('./polyfills');
    expect(P.withResolvers).toBe(original);
  });
});
