import type { DesligamentoRecord } from '../tipos';
import { carregarPdfjs, reiniciarWorker } from './pdf/carregarPdfjs';
import { extrairTexto, LimiteExcedido } from './pdf/extrairTexto';
import { inconsistencies, parseText } from './parser/campos';

export const MENSAGEM_PDF_ESCANEADO = 'PDF sem texto selecionável (escaneado)';

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

export async function processarArquivo(
  id: number,
  arquivo: File,
  referencia: string,
  limites: Partial<LimitesDoArquivo> = {},
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
    prazo = setTimeout(
      () => relogio.abort(new LimiteExcedido(`PDF demorou mais de ${Math.round(tempoMaximoMs / 1000)} s para ser lido`)),
      tempoMaximoMs,
    );
    const texto = await extrairTexto(dados, { maxPaginas, signal: relogio.signal });
    if (!texto.trim()) return registroVazio(id, nome, referencia, MENSAGEM_PDF_ESCANEADO);
    const campos = parseText(texto);
    const problemas = inconsistencies(campos);
    return {
      id,
      arquivo: nome,
      referencia,
      ...campos,
      ...SEM_CONFERENCIA,
      status: problemas.length === 0 ? 'OK' : 'REVISAR',
      inconsistencias: problemas,
    };
  } catch (erro) {
    if (erro instanceof LimiteExcedido) {
      // Se o tempo estourou, o worker pode estar preso nesse PDF: o próximo arquivo usa um novo.
      if (relogio.signal.aborted) {
        try {
          await reiniciarWorker();
        } catch {
          // Sem worker novo agora; o próximo arquivo tenta carregar o pdf.js de novo.
        }
      }
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
    registros.push(await processarArquivo(indice + 1, arquivo, referencia));
    opcoes.onProgresso?.(registros.length, arquivos.length);
  }
  return registros;
}
