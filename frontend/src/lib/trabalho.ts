import {
  CAMPOS_CONFERENCIA,
  CAMPOS_EDITAVEIS,
  type DesligamentoRecord,
  type Status,
} from '../tipos';

/**
 * Arquivo de trabalho: guarda os registros (com edições e conferências) num .json que o
 * usuário salva onde quiser. Nada fica no navegador. Ao abrir, tudo é validado campo a
 * campo, porque o arquivo pode ter sido editado à mão ou vir de outra fonte.
 */

const FORMATO = 'leitor-de-desligamentos/trabalho';
const VERSAO = 1;
export const MAX_REGISTROS_NO_TRABALHO = 5000;

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

function lerRegistro(bruto: unknown, posicao: number): DesligamentoRecord {
  const invalido = (campo: string) => new TrabalhoInvalido(`Registro ${posicao}: campo "${campo}" inválido.`);
  if (!ehObjeto(bruto)) throw new TrabalhoInvalido(`Registro ${posicao}: não é um registro.`);

  // Monta um objeto novo só com os campos conhecidos (chaves extras, inclusive __proto__, ficam de fora).
  const textos = {} as Record<(typeof CAMPOS_TEXTO)[number], string>;
  for (const campo of CAMPOS_TEXTO) {
    const valor = bruto[campo];
    if (typeof valor !== 'string') throw invalido(campo);
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

  return {
    id: posicao,
    ...textos,
    ...conferencias,
    status: status as Status,
    inconsistencias: [...(inconsistencias as string[])],
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
  if (conteudo.versao !== VERSAO) {
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
