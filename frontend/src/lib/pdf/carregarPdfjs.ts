type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let carregando: Promise<Pdfjs> | null = null;
/** O módulo já carregado, para ler o worker em uso sem esperar (ver reiniciarWorker). */
let carregado: Pdfjs | null = null;

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
      carregado = pdfjs;
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

/** O worker compartilhado em uso agora (null antes de o pdf.js carregar ou fora do navegador). */
export function workerEmUso(): Worker | null {
  return carregado?.GlobalWorkerOptions.workerPort ?? null;
}

/**
 * Troca o worker compartilhado por um novo (usado quando um PDF estoura o tempo e pode ter travado o atual).
 * Recebe o worker que o arquivo usou (`workerEmUso()` no começo da leitura) e só encerra esse:
 * se ele já foi trocado (por outro pedido, de outro arquivo ou lote), o worker novo, que pode
 * estar lendo o PDF de outro lote, fica.
 */
export async function reiniciarWorker(aposentado: Worker | null): Promise<void> {
  if (!carregado || typeof Worker === 'undefined' || !aposentado) return;
  const { GlobalWorkerOptions } = carregado;
  if (GlobalWorkerOptions.workerPort !== aposentado) return;
  aposentado.terminate();
  GlobalWorkerOptions.workerPort = criarWorker();
}
