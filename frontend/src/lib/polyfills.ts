/**
 * Polyfills para navegadores antigos (por exemplo, Chrome 109, o último do Windows 7/8).
 * O pdf.js usa estas APIs recentes mesmo no build "legacy". Cada uma só é definida se faltar.
 * Carregado no início da página (main.tsx) e dentro do worker do pdf.js (pdf/worker.ts).
 */

function definir(alvo: object, nome: string, valor: unknown) {
  if (typeof (alvo as Record<string, unknown>)[nome] === 'function') return;
  Object.defineProperty(alvo, nome, { value: valor, configurable: true, writable: true });
}

definir(Promise, 'withResolvers', function withResolvers<T>() {
  let resolve!: (valor: T | PromiseLike<T>) => void;
  let reject!: (motivo?: unknown) => void;
  const promise = new Promise<T>((aoResolver, aoRejeitar) => {
    resolve = aoResolver;
    reject = aoRejeitar;
  });
  return { promise, resolve, reject };
});

definir(Promise, 'try', function tentar<T>(funcao: (...argumentos: unknown[]) => T, ...argumentos: unknown[]) {
  return new Promise<T>((resolve) => resolve(funcao(...argumentos)));
});

definir(URL, 'parse', function parse(url: string, base?: string) {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
});

if (typeof AbortSignal !== 'undefined') {
  definir(AbortSignal, 'any', function any(sinais: AbortSignal[]) {
    const controlador = new AbortController();
    for (const sinal of sinais) {
      if (sinal.aborted) {
        controlador.abort(sinal.reason);
        break;
      }
      sinal.addEventListener('abort', () => controlador.abort(sinal.reason), { once: true });
    }
    return controlador.signal;
  });
}

export {};
