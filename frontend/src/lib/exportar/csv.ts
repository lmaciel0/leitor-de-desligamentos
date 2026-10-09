import type { DesligamentoRecord } from '../../tipos';
import { CABECALHO_EXPORTACAO, valoresDaLinha } from './colunas';

const BOM = '﻿';

function escapar(valor: string): string {
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

export function gerarCsv(registros: DesligamentoRecord[]): string {
  const linhas = [
    CABECALHO_EXPORTACAO.join(';'),
    ...registros.map((registro) => valoresDaLinha(registro).map(escapar).join(';')),
  ];
  return BOM + linhas.join('\n');
}
