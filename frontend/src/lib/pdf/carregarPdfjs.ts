type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let carregando: Promise<Pdfjs> | null = null;

/**
 * Carrega o pdf.js só quando o primeiro PDF for lido (deixa a abertura da página leve)
 * e cria um único worker, reaproveitado por todos os arquivos do lote.
 * Fora do navegador (testes em Node) não há Worker e o pdf.js usa o worker embutido.
 */
export function carregarPdfjs(): Promise<Pdfjs> {
  carregando ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    if (typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    }
    return pdfjs;
  });
  return carregando;
}
