import { CAMPOS_CONFERENCIA, type DesligamentoRecord } from '../../tipos';

export const CABECALHO_EXPORTACAO = [
  'ARQUIVO',
  'Referencia',
  'MUNICIPIO',
  'CPF',
  'NIS',
  'NIB',
  'NOME',
  'MOTIVO',
  'MUNICIPIO CONFERE',
  'ESTÁ VALIDADO',
  'RECEBE CMIC',
  'STATUS',
] as const;

const simOuNao = (marcado: boolean): string => (marcado ? 'SIM' : 'NÃO');

export function valoresDaLinha(registro: DesligamentoRecord): string[] {
  return [
    registro.arquivo,
    registro.referencia,
    registro.municipio,
    registro.cpf,
    registro.nis,
    registro.nib,
    registro.nome,
    registro.motivo,
    ...CAMPOS_CONFERENCIA.map((campo) => simOuNao(registro[campo])),
    registro.status,
  ].map((valor) => valor ?? '');
}

export function somenteRevisar(registros: DesligamentoRecord[]): DesligamentoRecord[] {
  return registros.filter((registro) => registro.status === 'REVISAR');
}
