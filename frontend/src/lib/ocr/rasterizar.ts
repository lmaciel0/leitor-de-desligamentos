import { carregarPdfjs } from '../pdf/carregarPdfjs';

/** PDF aberto para OCR: desenha uma página por vez num canvas. */
export interface PdfRasterizavel {
  total: number;
  renderizar(numero: number): Promise<HTMLCanvasElement>;
  destruir(): Promise<void>;
}

/** O pdf.js mede a página em pontos (72 por polegada); o OCR lê bem a cerca de 300 dpi. */
const DPI_DO_OCR = 300;
const ESCALA_DO_OCR = DPI_DO_OCR / 72;

/** A miniatura é só para o operador conferir os campos na tela de revisão. */
const LARGURA_MAXIMA_DA_MINIATURA = 900;
const QUALIDADE_DA_MINIATURA = 0.7;

export async function abrirPdfParaOcr(pdf: ArrayBuffer): Promise<PdfRasterizavel> {
  const { getDocument } = await carregarPdfjs();
  const tarefa = getDocument({ data: new Uint8Array(pdf) });
  let documento: Awaited<typeof tarefa.promise>;
  try {
    documento = await tarefa.promise;
  } catch (erro) {
    void tarefa.destroy().catch(() => {});
    throw erro;
  }
  return {
    total: documento.numPages,
    async renderizar(numero) {
      const pagina = await documento.getPage(numero);
      const viewport = pagina.getViewport({ scale: ESCALA_DO_OCR });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      try {
        await pagina.render({ canvas, viewport }).promise;
      } finally {
        pagina.cleanup();
      }
      return canvas;
    },
    destruir: () => tarefa.destroy(),
  };
}

/** Reduz a página para exibição e devolve um data URL JPEG (o CSP não aceita `blob:`). */
export function miniatura(canvas: HTMLCanvasElement): string {
  const escala = Math.min(1, LARGURA_MAXIMA_DA_MINIATURA / canvas.width);
  const reduzido = document.createElement('canvas');
  reduzido.width = Math.max(1, Math.round(canvas.width * escala));
  reduzido.height = Math.max(1, Math.round(canvas.height * escala));
  const contexto = reduzido.getContext('2d');
  if (!contexto) throw new Error('canvas 2D indisponível para a miniatura');
  contexto.drawImage(canvas, 0, 0, reduzido.width, reduzido.height);
  const dataUrl = reduzido.toDataURL('image/jpeg', QUALIDADE_DA_MINIATURA);
  // Solta a memória do canvas reduzido já.
  reduzido.width = 0;
  reduzido.height = 0;
  return dataUrl;
}
