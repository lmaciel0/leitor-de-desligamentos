import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Worker falso: o pdf.js só aceita como `workerPort` uma instância do `Worker` global. */
class WorkerFalso {
  static criados: WorkerFalso[] = [];
  terminate = vi.fn();
  constructor() {
    WorkerFalso.criados.push(this);
  }
}

const encerrados = () => WorkerFalso.criados.filter((worker) => worker.terminate.mock.calls.length > 0);

beforeAll(() => {
  vi.stubGlobal('Worker', WorkerFalso);
});

beforeEach(() => {
  WorkerFalso.criados = [];
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function portaAtual(): Promise<WorkerFalso> {
  const { GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return GlobalWorkerOptions.workerPort as unknown as WorkerFalso;
}

describe('reiniciarWorker', () => {
  it('pedido enquanto o pdf.js ainda carrega não encerra o worker recém-criado', async () => {
    const { carregarPdfjs, reiniciarWorker, workerEmUso } = await import('./carregarPdfjs');
    const carregando = carregarPdfjs();
    // Antes de o pdf.js carregar não há worker em uso: nada a aposentar.
    const emUso = workerEmUso();
    expect(emUso).toBeNull();
    await reiniciarWorker(emUso);
    await carregando;
    expect(WorkerFalso.criados).toHaveLength(1);
    expect(encerrados()).toEqual([]);
    expect(await portaAtual()).toBe(WorkerFalso.criados[0]);
  });

  it('só encerra o worker que estava em uso no pedido, não o que outro pedido já pôs no lugar', async () => {
    const { carregarPdfjs, reiniciarWorker, workerEmUso } = await import('./carregarPdfjs');
    await carregarPdfjs();
    const aposentado = await portaAtual();
    expect(workerEmUso()).toBe(aposentado);
    // Dois pedidos de troca do mesmo worker preso (ex.: lote cancelado e o seguinte): só ele é encerrado, uma vez.
    const emUso = workerEmUso();
    await Promise.all([reiniciarWorker(emUso), reiniciarWorker(emUso)]);
    expect(aposentado.terminate).toHaveBeenCalledTimes(1);
    // Um único worker novo, e nenhum worker novo encerrado.
    expect(WorkerFalso.criados).toHaveLength(1);
    expect(encerrados()).toEqual([]);
    expect(await portaAtual()).toBe(WorkerFalso.criados[0]);
  });
});
