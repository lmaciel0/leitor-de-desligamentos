type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let carregando: Promise<Pdfjs> | null = null;

function criarWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Carrega o pdf.js só quando o primeiro PDF for lido (deixa a abertura da página leve)
 * e cria um único worker, reaproveitado por todos os arquivos do lote.
 * Fora do navegador (testes em Node) não há Worker e o pdf.js usa o worker embutido.
 */
export function carregarPdfjs(): Promise<Pdfjs> {
  carregando ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(
    (pdfjs) => {
      if (typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = criarWorker();
      }
      return pdfjs;
    },
    (erro: unknown) => {
      // Falhou (rede, ou um deploy novo trocou os arquivos): a próxima chamada tenta de novo.
      carregando = null;
      throw erro;
    },
  );
  return carregando;
}

/** Troca o worker compartilhado por um novo (usado quando um PDF estoura o tempo e pode ter travado o atual). */
export async function reiniciarWorker(): Promise<void> {
  if (!carregando || typeof Worker === 'undefined') return;
  const pdfjs = await carregando;
  pdfjs.GlobalWorkerOptions.workerPort?.terminate();
  pdfjs.GlobalWorkerOptions.workerPort = criarWorker();
}
