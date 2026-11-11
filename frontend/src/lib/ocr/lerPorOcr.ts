import { LimiteExcedido } from '../pdf/extrairTexto';
import { geracaoDoMotor, prepararMotor, reconhecerImagem, reiniciarMotor } from './motorOcr';
import { normalizarTextoOcr } from './normalizarTextoOcr';
import { abrirPdfParaOcr, miniatura, type PdfRasterizavel } from './rasterizar';

export interface ResultadoOcr {
  texto: string;
  /** Miniatura (data URL) da página que serviu de fonte dos campos. */
  imagem: string | null;
}

export interface OpcoesOcr {
  maxPaginas: number;
  /** Interrompe a leitura (tempo ou lote cancelado); o erro lançado é o motivo do sinal. */
  sinal: AbortSignal;
  /** Chamado com o modelo já carregado, antes da primeira página: é aqui que o tempo do arquivo começa. */
  aoComecar?: (totalDePaginas: number) => void;
  aoIniciarPagina?: (pagina: number, total: number) => void;
}

export interface DependenciasOcr {
  abrirPdf(pdf: ArrayBuffer): Promise<PdfRasterizavel>;
  prepararMotor(): Promise<void>;
  reconhecer(canvas: HTMLCanvasElement): Promise<string>;
  miniatura(canvas: HTMLCanvasElement): string;
}

const DEPENDENCIAS_REAIS: DependenciasOcr = {
  abrirPdf: abrirPdfParaOcr,
  prepararMotor,
  reconhecer: reconhecerImagem,
  miniatura,
};

/** Os campos do formulário ficam na página que tem este rótulo. */
const ROTULO_DO_RESPONSAVEL = /NOME\s+DO\s+RESPONS[ÁA]VEL/i;

/** Espera a promessa, mas desiste assim que o sinal for abortado (o motor pode estar preso). */
function comSinal<T>(promessa: Promise<T>, sinal: AbortSignal): Promise<T> {
  if (sinal.aborted) return Promise.reject(sinal.reason);
  return new Promise<T>((resolver, rejeitar) => {
    const abortar = () => rejeitar(sinal.reason);
    sinal.addEventListener('abort', abortar, { once: true });
    promessa.then(resolver, rejeitar).finally(() => sinal.removeEventListener('abort', abortar));
  });
}

/** Solta já a memória do canvas a 300 dpi (dezenas de MB por página). */
function liberar(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function lerPorOcr(
  pdf: ArrayBuffer,
  opcoes: OpcoesOcr,
  deps: DependenciasOcr = DEPENDENCIAS_REAIS,
): Promise<ResultadoOcr> {
  const { maxPaginas, sinal, aoComecar, aoIniciarPagina } = opcoes;
  const abrindo = deps.abrirPdf(pdf);
  let documento: PdfRasterizavel;
  try {
    documento = await comSinal(abrindo, sinal);
  } catch (erro) {
    // Interrompido enquanto abria: o PDF que ainda abrir é fechado depois.
    void abrindo.then((aberto) => aberto.destruir()).catch(() => {});
    throw erro;
  }

  try {
    const { total } = documento;
    if (total > maxPaginas) throw new LimiteExcedido(`PDF com mais de ${maxPaginas} páginas`);
    await comSinal(deps.prepararMotor(), sinal);
    aoComecar?.(total);

    const paginas: string[] = [];
    let imagemDaPagina1: string | null = null;
    let imagemDoRotulo: string | null = null;
    for (let numero = 1; numero <= total; numero++) {
      if (sinal.aborted) throw sinal.reason;
      aoIniciarPagina?.(numero, total);
      const canvas = await comSinal(documento.renderizar(numero), sinal);
      try {
        const texto = normalizarTextoOcr(await comSinal(deps.reconhecer(canvas), sinal));
        paginas.push(texto);
        // Guarda só a miniatura da página que interessa, não as páginas a 300 dpi.
        if (numero === 1) imagemDaPagina1 = deps.miniatura(canvas);
        if (imagemDoRotulo === null && ROTULO_DO_RESPONSAVEL.test(texto)) {
          imagemDoRotulo = numero === 1 ? imagemDaPagina1 : deps.miniatura(canvas);
        }
      } finally {
        liberar(canvas);
      }
    }
    return { texto: paginas.join('\n'), imagem: imagemDoRotulo ?? imagemDaPagina1 };
  } finally {
    // Interrompido, o worker do pdf.js pode estar preso nesta página: o destroy() só responde
    // com o worker livre, então não esperamos por ele. Quem chamou troca o worker.
    if (sinal.aborted) void documento.destruir().catch(() => {});
    else await documento.destruir();
  }
}

/** Geração do motor de OCR em uso: guarde antes de ler e passe a `reiniciarOcr`. */
export function geracaoDoOcr(): number {
  return geracaoDoMotor();
}

/**
 * Encerra o motor de OCR real da geração dada (preso ou interrompido); o próximo PDF escaneado cria outro.
 * Se essa geração já foi trocada, o motor atual (talvez de outro lote) fica.
 */
export function reiniciarOcr(geracao: number): Promise<void> {
  return reiniciarMotor(geracao);
}
