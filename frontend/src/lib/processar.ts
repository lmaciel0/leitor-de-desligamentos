import type { DesligamentoRecord } from '../tipos';
import { carregarPdfjs, reiniciarWorker } from './pdf/carregarPdfjs';
import { extrairTexto, LimiteExcedido } from './pdf/extrairTexto';
import { avisosDeLeitura } from './ocr/avisosDeLeitura';
import { guardarImagem } from './ocr/imagens';
import { inconsistencies, parseText, recalcular } from './parser/campos';

type ModuloOcr = typeof import('./ocr/lerPorOcr');

export const MENSAGEM_OCR_VAZIO = 'PDF sem texto reconhecido pelo OCR';
const MENSAGEM_LOTE_CANCELADO = 'PDF não lido: o lote foi cancelado';

/**
 * Orçamento de tempo de um arquivo lido por OCR, proporcional às páginas (o OCR leva ~6 s por
 * página medidos; o orçamento dá folga para máquina lenta). Conta só depois de o modelo carregar.
 */
export const OCR_BASE_MS = 20_000;
export const OCR_POR_PAGINA_MS = 12_000;

export function orcamentoOcrMs(paginas: number): number {
  return OCR_BASE_MS + OCR_POR_PAGINA_MS * paginas;
}

/** Limites por arquivo: um PDF enorme ou malformado não pode travar a aba nem o lote. */
export interface LimitesDoArquivo {
  maxMegabytes: number;
  maxPaginas: number;
  tempoMaximoMs: number;
}

export const LIMITES_PADRAO: LimitesDoArquivo = { maxMegabytes: 20, maxPaginas: 10, tempoMaximoMs: 20_000 };

export function formatarReferencia(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

/** O operador marca estas conferências à mão, depois do processamento. */
const SEM_CONFERENCIA = { municipioConfere: false, validado: false, recebeCmic: false } as const;

function registroVazio(id: number, arquivo: string, referencia: string, problema: string): DesligamentoRecord {
  return {
    id,
    arquivo,
    referencia,
    municipio: '',
    cpf: '',
    nis: '',
    nib: '',
    nome: '',
    motivo: '',
    ...SEM_CONFERENCIA,
    status: 'REVISAR',
    inconsistencias: [problema],
  };
}

function mensagemDeTempo(ms: number): string {
  return `PDF demorou mais de ${Math.round(ms / 1000)} s para ser lido`;
}

function registroDoTexto(id: number, arquivo: string, referencia: string, texto: string): DesligamentoRecord {
  const campos = parseText(texto);
  const problemas = inconsistencies(campos);
  return {
    id,
    arquivo,
    referencia,
    ...campos,
    ...SEM_CONFERENCIA,
    status: problemas.length === 0 ? 'OK' : 'REVISAR',
    inconsistencias: problemas,
  };
}

/** Troca o worker (que pode estar preso num PDF); se não der agora, o próximo arquivo tenta carregar de novo. */
async function trocarWorker(): Promise<void> {
  try {
    await reiniciarWorker();
  } catch {
    // Sem worker novo agora; carregarPdfjs tenta de novo no próximo arquivo.
  }
}

/** Descarta o motor de OCR (pode estar preso numa página); o próximo PDF escaneado cria outro. */
async function trocarMotorOcr(ocr: ModuloOcr): Promise<void> {
  try {
    await ocr.reiniciarOcr();
  } catch {
    // Sem motor novo agora; o próximo PDF escaneado tenta criar.
  }
}

function quandoAbortar(sinal: AbortSignal): Promise<never> {
  return new Promise((_, rejeitar) => {
    if (sinal.aborted) rejeitar(sinal.reason);
    else sinal.addEventListener('abort', () => rejeitar(sinal.reason), { once: true });
  });
}

export interface ExtrasDoArquivo {
  /** Cancelamento do lote: interrompe o OCR em andamento. */
  sinalDoLote?: AbortSignal;
  /** Etapa em andamento, para o operador saber que um arquivo está em OCR (é lento). */
  onEtapa?: (mensagem: string) => void;
}

/**
 * PDF sem texto (escaneado): lê por OCR, com relógio próprio que só começa com o modelo carregado.
 * Estourar o tempo ou cancelar o lote descarta o motor de OCR e o worker do pdf.js.
 */
async function registroDoOcr(
  arquivo: File,
  id: number,
  nome: string,
  referencia: string,
  maxPaginas: number,
  { sinalDoLote, onEtapa }: ExtrasDoArquivo,
): Promise<DesligamentoRecord> {
  const ocr = await import('./ocr/lerPorOcr');
  const relogio = new AbortController();
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const cancelarPeloLote = () => relogio.abort(new LimiteExcedido(MENSAGEM_LOTE_CANCELADO));
  if (sinalDoLote?.aborted) cancelarPeloLote();
  else sinalDoLote?.addEventListener('abort', cancelarPeloLote, { once: true });
  try {
    // Lido de novo: o pdf.js pode ter tomado para o worker o buffer usado na extração de texto.
    const dados = await arquivo.arrayBuffer();
    const leitura = ocr.lerPorOcr(dados, {
      maxPaginas,
      sinal: relogio.signal,
      aoComecar: (total) => {
        const orcamento = orcamentoOcrMs(total);
        prazo = setTimeout(() => relogio.abort(new LimiteExcedido(mensagemDeTempo(orcamento))), orcamento);
      },
      aoIniciarPagina: (pagina, total) => onEtapa?.(`Lendo ${nome} por OCR (página ${pagina} de ${total})`),
    });
    // O motor pode estar preso e nunca responder: o relógio e o lote não esperam por ele.
    const { texto, imagem } = await Promise.race([leitura, quandoAbortar(relogio.signal)]);
    if (!texto.trim()) return registroVazio(id, nome, referencia, MENSAGEM_OCR_VAZIO);
    const registro = recalcular({
      id,
      arquivo: nome,
      referencia,
      ...parseText(texto),
      ...SEM_CONFERENCIA,
      lidoPorOcr: true,
      avisosOcr: avisosDeLeitura(texto),
      status: 'REVISAR',
      inconsistencias: [],
    });
    if (imagem) guardarImagem(id, imagem);
    return registro;
  } catch (erro) {
    if (relogio.signal.aborted) await Promise.all([trocarMotorOcr(ocr), trocarWorker()]);
    else if (erro instanceof LimiteExcedido) await trocarMotorOcr(ocr);
    throw erro;
  } finally {
    clearTimeout(prazo);
    sinalDoLote?.removeEventListener('abort', cancelarPeloLote);
  }
}

export async function processarArquivo(
  id: number,
  arquivo: File,
  referencia: string,
  limites: Partial<LimitesDoArquivo> = {},
  extras: ExtrasDoArquivo = {},
): Promise<DesligamentoRecord> {
  const { maxMegabytes, maxPaginas, tempoMaximoMs } = { ...LIMITES_PADRAO, ...limites };
  const nome = arquivo.name?.trim() ? arquivo.name : 'arquivo.pdf';
  if (arquivo.size > maxMegabytes * 1024 * 1024) {
    return registroVazio(id, nome, referencia, `PDF maior que ${maxMegabytes} MB`);
  }

  const relogio = new AbortController();
  let prazo: ReturnType<typeof setTimeout> | undefined;
  try {
    const dados = await arquivo.arrayBuffer();
    // Carregar o pdf.js (só na primeira vez) não conta no tempo do arquivo: em máquina lenta,
    // isso faria o primeiro PDF "demorar demais" sem motivo.
    await carregarPdfjs();
    prazo = setTimeout(() => relogio.abort(new LimiteExcedido(mensagemDeTempo(tempoMaximoMs))), tempoMaximoMs);
    const texto = await extrairTexto(dados, { maxPaginas, signal: relogio.signal });
    if (texto.trim()) return registroDoTexto(id, nome, referencia, texto);
    // Sem texto: PDF escaneado. O relógio da leitura de texto para aqui; o OCR tem o seu.
    clearTimeout(prazo);
    return await registroDoOcr(arquivo, id, nome, referencia, maxPaginas, extras);
  } catch (erro) {
    if (erro instanceof LimiteExcedido) {
      // Se o tempo estourou, o worker pode estar preso nesse PDF: o próximo arquivo usa um novo.
      if (relogio.signal.aborted) await trocarWorker();
      return registroVazio(id, nome, referencia, erro.message);
    }
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return registroVazio(id, nome, referencia, `erro de processamento: ${mensagem}`);
  } finally {
    clearTimeout(prazo);
  }
}

export interface OpcoesDoLote {
  onProgresso?: (feitos: number, total: number) => void;
  signal?: AbortSignal;
  /** Etapa em andamento dentro de um arquivo (ex.: página lida por OCR). */
  onEtapa?: (mensagem: string) => void;
}

export async function processarLote(
  arquivos: File[],
  hoje: Date,
  opcoes: OpcoesDoLote = {},
): Promise<DesligamentoRecord[]> {
  const referencia = formatarReferencia(hoje);
  const registros: DesligamentoRecord[] = [];
  for (const [indice, arquivo] of arquivos.entries()) {
    if (opcoes.signal?.aborted) break;
    registros.push(
      await processarArquivo(indice + 1, arquivo, referencia, {}, { sinalDoLote: opcoes.signal, onEtapa: opcoes.onEtapa }),
    );
    opcoes.onProgresso?.(registros.length, arquivos.length);
  }
  return registros;
}
