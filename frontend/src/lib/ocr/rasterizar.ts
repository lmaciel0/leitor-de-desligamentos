import { carregarPdfjs } from '../pdf/carregarPdfjs';
import { LimiteExcedido } from '../pdf/extrairTexto';

/** PDF aberto para OCR: desenha uma página por vez num canvas. */
export interface PdfRasterizavel {
  total: number;
  renderizar(numero: number): Promise<HTMLCanvasElement>;
  destruir(): Promise<void>;
}

/** O pdf.js mede a página em pontos (72 por polegada); o OCR lê bem a cerca de 300 dpi. */
const DPI_DO_OCR = 300;
const ESCALA_DO_OCR = DPI_DO_OCR / 72;

/**
 * Tetos do canvas da página: um PDF hostil (ou só estranho) declara a página do tamanho que quiser,
 * e a 300 dpi isso seria um canvas de gigabytes. Acima deles a página é desenhada com menos dpi.
 * 25 milhões de pixels (~100 MB em RGBA) cabem com folga uma página A3 a 300 dpi.
 */
export const MAX_PIXELS_DO_CANVAS = 25e6;
export const MAX_LADO_DO_CANVAS = 10_000;
/** O PDF não permite página maior que 14 400 pontos (200 polegadas); acima disso, o arquivo é inválido. */
const MAX_LADO_DA_PAGINA_PT = 14_400;
/** Imagens embutidas maiores que isso (em pixels) o pdf.js não decodifica. */
const MAX_PIXELS_DA_IMAGEM = 50e6;

const PAGINA_INVALIDA = 'PDF com página de tamanho inválido';

/** A miniatura é só para o operador conferir os campos na tela de revisão. */
export const LARGURA_MAXIMA_DA_MINIATURA = 900;
/** Folga para A4 e ofício (a 900 px de largura) sem que uma página estreita e comprida gere um data URL enorme. */
export const ALTURA_MAXIMA_DA_MINIATURA = 1800;
const QUALIDADE_DA_MINIATURA = 0.7;

/**
 * Escala para desenhar a página (medida em pontos, na escala 1) para o OCR: 300 dpi, ou menos se
 * o canvas passar dos tetos de pixels ou de lado. Página sem medida válida é recusada.
 */
export function escalaDoOcr(largura: number, altura: number): number {
  const valida =
    Number.isFinite(largura) &&
    Number.isFinite(altura) &&
    largura > 0 &&
    altura > 0 &&
    Math.max(largura, altura) <= MAX_LADO_DA_PAGINA_PT;
  if (!valida) throw new LimiteExcedido(PAGINA_INVALIDA);
  const escala = Math.min(
    ESCALA_DO_OCR,
    Math.sqrt(MAX_PIXELS_DO_CANVAS / (largura * altura)),
    MAX_LADO_DO_CANVAS / Math.max(largura, altura),
  );
  // Fina demais: um dos lados não chega a um pixel.
  if (Math.floor(Math.min(largura, altura) * escala) < 1) throw new LimiteExcedido(PAGINA_INVALIDA);
  return escala;
}

/** Tamanho da miniatura: até 900 px de largura e 1800 de altura, na proporção, sem ampliar. */
export function tamanhoDaMiniatura(largura: number, altura: number): { largura: number; altura: number } {
  const escala = Math.min(1, LARGURA_MAXIMA_DA_MINIATURA / largura, ALTURA_MAXIMA_DA_MINIATURA / altura);
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

export async function abrirPdfParaOcr(pdf: ArrayBuffer): Promise<PdfRasterizavel> {
  const { getDocument } = await carregarPdfjs();
  const tarefa = getDocument({ data: new Uint8Array(pdf), maxImageSize: MAX_PIXELS_DA_IMAGEM });
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
      try {
        const medida = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: escalaDoOcr(medida.width, medida.height) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await pagina.render({ canvas, viewport }).promise;
        return canvas;
      } finally {
        pagina.cleanup();
      }
    },
    destruir: () => tarefa.destroy(),
  };
}

/** Reduz a página para exibição e devolve um data URL JPEG (o CSP não aceita `blob:`). */
export function miniatura(canvas: HTMLCanvasElement): string {
  const tamanho = tamanhoDaMiniatura(canvas.width, canvas.height);
  const reduzido = document.createElement('canvas');
  reduzido.width = tamanho.largura;
  reduzido.height = tamanho.altura;
  const contexto = reduzido.getContext('2d');
  if (!contexto) throw new Error('canvas 2D indisponível para a miniatura');
  contexto.drawImage(canvas, 0, 0, reduzido.width, reduzido.height);
  const dataUrl = reduzido.toDataURL('image/jpeg', QUALIDADE_DA_MINIATURA);
  // Solta a memória do canvas reduzido já.
  reduzido.width = 0;
  reduzido.height = 0;
  return dataUrl;
}
