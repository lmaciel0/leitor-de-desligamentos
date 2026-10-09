import writeExcelFile from 'write-excel-file/universal';
import type { DesligamentoRecord } from '../../tipos';
import { CABECALHO_EXPORTACAO, valoresDaLinha } from './colunas';

const LARGURA_MAXIMA = 60;

export async function gerarXlsx(registros: DesligamentoRecord[]): Promise<Blob> {
  const linhas = registros.map(valoresDaLinha);
  const colunas = CABECALHO_EXPORTACAO.map((titulo, coluna) => {
    const maior = linhas.reduce((atual, linha) => Math.max(atual, linha[coluna].length), titulo.length);
    return { width: Math.min(LARGURA_MAXIMA, maior + 2) };
  });
  const dados = [
    CABECALHO_EXPORTACAO.map((titulo) => ({ value: titulo, fontWeight: 'bold' as const })),
    ...linhas.map((linha) => linha.map((value) => ({ value, type: String, format: '@' }))),
  ];
  return writeExcelFile(dados, { sheet: 'Desligamentos', columns: colunas }).toBlob();
}
