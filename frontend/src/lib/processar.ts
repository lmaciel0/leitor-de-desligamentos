import type { DesligamentoRecord } from '../tipos';
import { extrairTexto } from './pdf/extrairTexto';
import { inconsistencies, parseText } from './parser/campos';

export const MENSAGEM_PDF_ESCANEADO = 'PDF sem texto selecionável (escaneado)';

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

export async function processarArquivo(id: number, arquivo: File, referencia: string): Promise<DesligamentoRecord> {
  const nome = arquivo.name?.trim() ? arquivo.name : 'arquivo.pdf';
  try {
    const texto = await extrairTexto(await arquivo.arrayBuffer());
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
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return registroVazio(id, nome, referencia, `erro de processamento: ${mensagem}`);
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
