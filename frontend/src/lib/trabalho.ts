import { CAMPOS_CONFERENCIA, CAMPOS_EDITAVEIS, type DesligamentoRecord } from '../tipos';
import { PENDENCIA_OCR, pendenciasDoRegistro } from './parser/campos';

/**
 * Arquivo de trabalho: guarda os registros (com edições e conferências) num .json que o
 * usuário salva onde quiser. Nada fica no navegador. Ao abrir, tudo é validado campo a
 * campo, porque o arquivo pode ter sido editado à mão ou vir de outra fonte.
 */

const FORMATO = 'leitor-de-desligamentos/trabalho';
const VERSAO = 2;
/** A versão 1 não tem a marca de OCR; continua abrindo. */
const VERSOES_ACEITAS: readonly unknown[] = [1, 2];
export const MAX_REGISTROS_NO_TRABALHO = 5000;
/** Nenhum campo do formulário chega perto disso; acima, o arquivo foi alterado ou está corrompido. */
const MAX_CARACTERES_POR_CAMPO = 1000;
const MAX_PENDENCIAS = 50;

/** Pendências geradas na leitura do PDF (tamanho, páginas, tempo, escaneado, erro): não vêm dos campos. */
function ehPendenciaDaLeitura(pendencia: string): boolean {
  return pendencia.startsWith('PDF ') || pendencia.startsWith('erro de processamento');
}

export class TrabalhoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'TrabalhoInvalido';
  }
}

const NAO_E_TRABALHO = 'Este arquivo não é um trabalho do Leitor de desligamentos.';
const CAMPOS_TEXTO = ['arquivo', 'referencia', ...CAMPOS_EDITAVEIS] as const;

export function gerarTrabalho(registros: DesligamentoRecord[], salvoEm: Date): string {
  return JSON.stringify({ formato: FORMATO, versao: VERSAO, salvoEm: salvoEm.toISOString(), registros }, null, 2);
}

/** "09/10/2026 às 14:30", para avisar de quando é o trabalho aberto. */
export function descreverData(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} às ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

export function nomeDoArquivoDeTrabalho(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `trabalho-desligamentos-${data.getFullYear()}-${mes}-${dia}.json`;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lê `lidoPorOcr` e `avisosOcr` (ausentes em trabalhos da versão 1): só devolve as chaves que existem no arquivo. */
function lerMarcaDeOcr(
  bruto: Record<string, unknown>,
  invalido: (campo: string) => Error,
  grandeDemais: (campo: string) => Error,
): { lidoPorOcr?: boolean; avisosOcr?: string[] } {
  const ocr: { lidoPorOcr?: boolean; avisosOcr?: string[] } = {};
  if (bruto.lidoPorOcr !== undefined) {
    if (typeof bruto.lidoPorOcr !== 'boolean') throw invalido('lidoPorOcr');
    ocr.lidoPorOcr = bruto.lidoPorOcr;
  }
  const avisos = bruto.avisosOcr;
  if (avisos !== undefined) {
    if (!Array.isArray(avisos) || !avisos.every((item) => typeof item === 'string')) throw invalido('avisosOcr');
    if (avisos.length > MAX_PENDENCIAS || (avisos as string[]).some((item) => item.length > MAX_CARACTERES_POR_CAMPO)) {
      throw grandeDemais('avisosOcr');
    }
    ocr.avisosOcr = avisos as string[];
  }
  return ocr;
}

/** Lê `revisarNoLote` (opcional): só devolve a chave se ela existir no arquivo. */
function lerRevisaoNoLote(bruto: Record<string, unknown>, invalido: (campo: string) => Error): { revisarNoLote?: boolean } {
  if (bruto.revisarNoLote === undefined) return {};
  if (typeof bruto.revisarNoLote !== 'boolean') throw invalido('revisarNoLote');
  return { revisarNoLote: bruto.revisarNoLote };
}

function lerRegistro(bruto: unknown, posicao: number): DesligamentoRecord {
  const invalido = (campo: string) => new TrabalhoInvalido(`Registro ${posicao}: campo "${campo}" inválido.`);
  if (!ehObjeto(bruto)) throw new TrabalhoInvalido(`Registro ${posicao}: não é um registro.`);

  // Monta um objeto novo só com os campos conhecidos (chaves extras, inclusive __proto__, ficam de fora).
  const grandeDemais = (campo: string) => new TrabalhoInvalido(`Registro ${posicao}: campo "${campo}" grande demais.`);
  const textos = {} as Record<(typeof CAMPOS_TEXTO)[number], string>;
  for (const campo of CAMPOS_TEXTO) {
    const valor = bruto[campo];
    if (typeof valor !== 'string') throw invalido(campo);
    if (valor.length > MAX_CARACTERES_POR_CAMPO) throw grandeDemais(campo);
    textos[campo] = valor;
  }
  const conferencias = {} as Record<(typeof CAMPOS_CONFERENCIA)[number], boolean>;
  for (const campo of CAMPOS_CONFERENCIA) {
    const valor = bruto[campo];
    if (typeof valor !== 'boolean') throw invalido(campo);
    conferencias[campo] = valor;
  }
  const status = bruto.status;
  if (status !== 'OK' && status !== 'REVISAR') throw invalido('status');
  const inconsistencias = bruto.inconsistencias;
  if (!Array.isArray(inconsistencias) || !inconsistencias.every((item) => typeof item === 'string')) {
    throw invalido('inconsistencias');
  }
  if (
    inconsistencias.length > MAX_PENDENCIAS ||
    (inconsistencias as string[]).some((item) => item.length > MAX_CARACTERES_POR_CAMPO)
  ) {
    throw grandeDemais('inconsistencias');
  }

  const ocr = lerMarcaDeOcr(bruto, invalido, grandeDemais);
  const revisao = lerRevisaoNoLote(bruto, invalido);
  // Sem a marca, mas com a pendência de OCR (a marca foi apagada à mão): continua registro de OCR,
  // em REVISAR até ser validado. Marca explícita (true ou false) prevalece.
  if (ocr.lidoPorOcr === undefined && (inconsistencias as string[]).includes(PENDENCIA_OCR)) ocr.lidoPorOcr = true;

  // O status salvo não é confiável (o arquivo pode ter sido editado): recalcula a partir dos
  // campos, como numa edição. As pendências da leitura do PDF não dá para recalcular; ficam.
  // Em registro de OCR a pendência de OCR também é recalculada: não pode ser duplicada nem sumir por edição à mão.
  const daLeitura = (inconsistencias as string[]).filter((item) => ehPendenciaDaLeitura(item) && item !== PENDENCIA_OCR);
  const problemas = [...daLeitura, ...pendenciasDoRegistro({ ...textos, ...conferencias, ...ocr })];
  return {
    id: posicao,
    ...textos,
    ...conferencias,
    ...ocr,
    ...revisao,
    status: problemas.length === 0 ? 'OK' : 'REVISAR',
    inconsistencias: problemas,
  };
}

export function lerTrabalho(texto: string): { registros: DesligamentoRecord[]; salvoEm: Date } {
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(texto);
  } catch {
    throw new TrabalhoInvalido(NAO_E_TRABALHO);
  }
  if (!ehObjeto(conteudo) || conteudo.formato !== FORMATO) throw new TrabalhoInvalido(NAO_E_TRABALHO);
  if (!VERSOES_ACEITAS.includes(conteudo.versao)) {
    throw new TrabalhoInvalido(
      `Este trabalho foi salvo na versão ${String(conteudo.versao)} do formato, que esta versão do Leitor não sabe abrir.`,
    );
  }
  const salvoEm = new Date(typeof conteudo.salvoEm === 'string' ? conteudo.salvoEm : Number.NaN);
  if (Number.isNaN(salvoEm.getTime())) throw new TrabalhoInvalido('O arquivo de trabalho está corrompido: campo "salvoEm" inválido.');
  const brutos = conteudo.registros;
  if (!Array.isArray(brutos)) throw new TrabalhoInvalido('O arquivo de trabalho está corrompido: lista de registros ausente.');
  if (brutos.length > MAX_REGISTROS_NO_TRABALHO) {
    throw new TrabalhoInvalido(`O trabalho tem mais de ${MAX_REGISTROS_NO_TRABALHO} registros.`);
  }
  return { registros: brutos.map((bruto, indice) => lerRegistro(bruto, indice + 1)), salvoEm };
}
