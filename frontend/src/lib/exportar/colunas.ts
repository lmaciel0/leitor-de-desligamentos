import type { DesligamentoRecord } from '../../tipos';

export const CABECALHO_EXPORTACAO = [
  'ARQUIVO',
  'Referencia',
  'MUNICIPIO',
  'CPF',
  'NIS',
  'NOME',
  'MOTIVO',
  'STATUS',
] as const;

export function valoresDaLinha(registro: DesligamentoRecord): string[] {
  return [
    registro.arquivo,
    registro.referencia,
    registro.municipio,
    registro.cpf,
    registro.nis,
    registro.nome,
    registro.motivo,
    registro.status,
  ].map((valor) => valor ?? '');
}

export function somenteRevisar(registros: DesligamentoRecord[]): DesligamentoRecord[] {
  return registros.filter((registro) => registro.status === 'REVISAR');
}
