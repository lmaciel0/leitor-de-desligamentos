import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../../tipos';
import { somenteRevisar } from './colunas';
import { gerarCsv } from './csv';
import { gerarXlsx } from './xlsx';

function registro(parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '17/09/2026',
    municipio: 'CIDADE EXEMPLO',
    cpf: '00123456789',
    nis: '000123456789',
    nib: '0012345678',
    nome: 'MARIA DA SILVA',
    motivo: 'OUTRO: Mudança',
    municipioConfere: false,
    validado: false,
    recebeCmic: false,
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

describe('gerarCsv', () => {
  it('começa com BOM e o cabeçalho esperado, separado por ponto e vírgula', () => {
    const csv = gerarCsv([registro()]);
    expect(csv.startsWith('﻿ARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NIB;NOME;MOTIVO;MUNICIPIO CONFERE;ESTÁ VALIDADO;RECEBE CMIC;STATUS\n')).toBe(true);
    expect(csv.split('\n')[1]).toBe(
      'a.pdf;17/09/2026;CIDADE EXEMPLO;00123456789;000123456789;0012345678;MARIA DA SILVA;OUTRO: Mudança;NÃO;NÃO;NÃO;OK',
    );
  });

  it('preserva zeros à esquerda de CPF e NIS', () => {
    const csv = gerarCsv([registro({ cpf: '00000000001', nis: '0001' })]);
    expect(csv).toContain(';00000000001;0001;');
  });

  it('coloca entre aspas campos com ponto e vírgula, aspas ou quebra de linha', () => {
    const csv = gerarCsv([registro({ arquivo: 'a;"b".pdf', nome: 'linha1\nlinha2', motivo: 'x\r\ny' })]);
    expect(csv).toContain('"a;""b"".pdf"');
    expect(csv).toContain('"linha1\nlinha2"');
    expect(csv).toContain('"x\r\ny"');
  });

  it('neutraliza valores que o Excel interpretaria como fórmula', () => {
    const csv = gerarCsv([registro({ arquivo: '@x.pdf', municipio: '+A', nome: '=1+1', motivo: '-2' })]);
    expect(csv).toContain("'@x.pdf;");
    expect(csv).toContain("'+A;");
    expect(csv).toContain("'=1+1;");
    expect(csv).toContain("'-2;");
  });

  it('exporta as marcações de conferência como SIM e NÃO', () => {
    const csv = gerarCsv([registro({ municipioConfere: true, validado: false, recebeCmic: true })]);
    expect(csv.split('\n')[1]).toContain(';MARIA DA SILVA;OUTRO: Mudança;SIM;NÃO;SIM;OK');
  });

  it('não altera valores comuns', () => {
    const csv = gerarCsv([registro()]);
    expect(csv).toContain(';MARIA DA SILVA;');
    expect(csv).not.toContain("'");
  });

  it('gera apenas o cabeçalho para lista vazia', () => {
    expect(gerarCsv([])).toBe('﻿ARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NIB;NOME;MOTIVO;MUNICIPIO CONFERE;ESTÁ VALIDADO;RECEBE CMIC;STATUS');
  });
});

describe('gerarXlsx', () => {
  async function abrir(registros: DesligamentoRecord[]) {
    const blob = await gerarXlsx(registros);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, arquivos: unzipSync(bytes) };
  }

  it('é um contêiner ZIP com a aba "Desligamentos"', async () => {
    const { bytes, arquivos } = await abrir([registro()]);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    expect(strFromU8(arquivos['xl/workbook.xml'])).toContain('name="Desligamentos"');
  });

  it('grava CPF e NIS como texto, preservando zeros à esquerda', async () => {
    const { arquivos } = await abrir([registro({ cpf: '00123456789', nis: '0001' })]);
    const textos = strFromU8(arquivos['xl/sharedStrings.xml']);
    expect(textos).toContain('<t>00123456789</t>');
    expect(textos).toContain('<t>0001</t>');
    const planilha = strFromU8(arquivos['xl/worksheets/sheet1.xml']);
    expect(planilha).not.toContain('t="n"');
  });

  it('inclui o cabeçalho e uma linha por registro', async () => {
    const { arquivos } = await abrir([registro(), registro({ id: 2, arquivo: 'b.pdf' })]);
    const textos = strFromU8(arquivos['xl/sharedStrings.xml']);
    for (const titulo of ['ARQUIVO', 'Referencia', 'MUNICIPIO', 'CPF', 'NIS', 'NIB', 'NOME', 'MOTIVO', 'MUNICIPIO CONFERE', 'ESTÁ VALIDADO', 'RECEBE CMIC', 'STATUS']) {
      expect(textos).toContain(`<t>${titulo}</t>`);
    }
    expect(textos).toContain('<t>b.pdf</t>');
  });

  it('grava as marcações de conferência como texto SIM e NÃO', async () => {
    const { arquivos } = await abrir([registro({ validado: true })]);
    const textos = strFromU8(arquivos['xl/sharedStrings.xml']);
    expect(textos).toContain('<t>SIM</t>');
    expect(textos).toContain('<t>NÃO</t>');
  });

  it('aceita lista vazia', async () => {
    const { arquivos } = await abrir([]);
    expect(strFromU8(arquivos['xl/workbook.xml'])).toContain('name="Desligamentos"');
  });
});

describe('somenteRevisar', () => {
  it('mantém apenas os registros REVISAR', () => {
    const lista = [registro({ id: 1 }), registro({ id: 2, status: 'REVISAR' })];
    expect(somenteRevisar(lista).map((r) => r.id)).toEqual([2]);
  });
});
