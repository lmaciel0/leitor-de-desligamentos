import { writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** Formulário sintético no layout real (dados fictícios, CPF e NIS com dígitos válidos). */
export function linhasDoFormulario(opcoes: { nome: string; cpf?: string }): string[] {
  const linhas = [
    'FORMULÁRIO DE SOLICITAÇÃO DE DESLIGAMENTO DE BENEFICIÁRIOS',
    'MUNICÍPIO: CIDADE EXEMPLO',
    `NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ${opcoes.nome}`,
    `DATA NASC.: 10/08/1990 ${opcoes.cpf ?? 'CPF: 529.982.247-25'}`,
    'NIB: 1234567890 NIS:12345678919',
    ' MOTIVO DO DESLIGAMENTO:',
    '( ) Processo de fiscalização;',
    '( X ) Mudança para outro Município;',
    '( ) OUTRO:________________',
    ' DATA EM QUE SAIU DO PERFIL DO CMIC: 01/07/2026',
  ];
  return linhas;
}

export async function criarPdf(caminho: string, linhas: string[]): Promise<string> {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  const pagina = documento.addPage([595, 842]);
  linhas.forEach((texto, i) => pagina.drawText(texto, { x: 40, y: 800 - i * 20, size: 10, font: fonte }));
  writeFileSync(caminho, await documento.save());
  return caminho;
}
