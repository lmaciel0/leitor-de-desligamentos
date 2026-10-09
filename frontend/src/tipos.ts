export type Status = 'OK' | 'REVISAR';

export type CampoEditavel = 'municipio' | 'cpf' | 'nis' | 'nome' | 'motivo';

export const CAMPOS_EDITAVEIS: readonly CampoEditavel[] = ['municipio', 'cpf', 'nis', 'nome', 'motivo'];

export type CamposDesligamento = Record<CampoEditavel, string>;

export interface DesligamentoRecord extends CamposDesligamento {
  id: number;
  arquivo: string;
  /** Data do processamento em dd/MM/yyyy. */
  referencia: string;
  status: Status;
  inconsistencias: string[];
}
