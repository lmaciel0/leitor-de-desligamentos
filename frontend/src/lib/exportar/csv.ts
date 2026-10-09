import type { DesligamentoRecord } from '../../tipos';
import { CABECALHO_EXPORTACAO, valoresDaLinha } from './colunas';

const BOM = '﻿';

/** O Excel interpreta como fórmula quem começa com estes caracteres; os valores vêm de PDFs de terceiros. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

function escapar(valor: string): string {
  const seguro = INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
  if (/[;"\r\n]/.test(seguro)) return `"${seguro.replace(/"/g, '""')}"`;
  return seguro;
}

export function gerarCsv(registros: DesligamentoRecord[]): string {
  const linhas = [
    CABECALHO_EXPORTACAO.join(';'),
    ...registros.map((registro) => valoresDaLinha(registro).map(escapar).join(';')),
  ];
  return BOM + linhas.join('\n');
}
