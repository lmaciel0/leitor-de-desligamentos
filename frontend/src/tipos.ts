export type Status = 'OK' | 'REVISAR';

export type CampoEditavel = 'municipio' | 'cpf' | 'nis' | 'nib' | 'nome' | 'motivo';

export const CAMPOS_EDITAVEIS: readonly CampoEditavel[] = ['municipio', 'cpf', 'nis', 'nib', 'nome', 'motivo'];

export type CamposDesligamento = Record<CampoEditavel, string>;

/** Marcações feitas à mão pelo operador; não influenciam o status OK/REVISAR. */
export type CampoConferencia = 'municipioConfere' | 'validado' | 'recebeCmic';

export const CAMPOS_CONFERENCIA: readonly CampoConferencia[] = ['municipioConfere', 'validado', 'recebeCmic'];

export const TITULOS_CONFERENCIA: Record<CampoConferencia, string> = {
  municipioConfere: 'Município confere',
  validado: 'Está validado',
  recebeCmic: 'Recebe CMIC',
};

export type ConferenciaDesligamento = Record<CampoConferencia, boolean>;

export interface DesligamentoRecord extends CamposDesligamento, ConferenciaDesligamento {
  id: number;
  arquivo: string;
  /** Data do processamento em dd/MM/yyyy. */
  referencia: string;
  status: Status;
  inconsistencias: string[];
}
