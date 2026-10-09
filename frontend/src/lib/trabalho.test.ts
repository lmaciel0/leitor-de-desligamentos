import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../tipos';
import { gerarTrabalho, lerTrabalho, nomeDoArquivoDeTrabalho, TrabalhoInvalido } from './trabalho';

function registro(parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '12345678900',
    nib: '1234567890',
    nome: 'ANA',
    motivo: 'Mudança',
    municipioConfere: true,
    validado: false,
    recebeCmic: true,
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const salvoEm = new Date(2026, 9, 9, 14, 30);

describe('arquivo de trabalho', () => {
  it('salva e abre de volta os mesmos registros, com edições e conferências', () => {
    const registros = [registro(), registro({ id: 2, arquivo: 'b.pdf', status: 'REVISAR', inconsistencias: ['PDF maior que 20 MB'] })];
    const lido = lerTrabalho(gerarTrabalho(registros, salvoEm));
    expect(lido.registros).toEqual(registros);
    expect(lido.salvoEm.getTime()).toBe(salvoEm.getTime());
  });

  it('identifica o formato e a versão no arquivo', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro()], salvoEm));
    expect(conteudo.formato).toBe('leitor-de-desligamentos/trabalho');
    expect(conteudo.versao).toBe(1);
  });

  it('renumera os ids ao abrir, para não haver repetidos', () => {
    const texto = gerarTrabalho([registro({ id: 7 }), registro({ id: 7, arquivo: 'b.pdf' })], salvoEm);
    expect(lerTrabalho(texto).registros.map((r) => r.id)).toEqual([1, 2]);
  });

  it('recusa o que não é JSON', () => {
    expect(() => lerTrabalho('isto não é json')).toThrow(TrabalhoInvalido);
    expect(() => lerTrabalho('isto não é json')).toThrow('Este arquivo não é um trabalho do Leitor de desligamentos.');
  });

  it('recusa JSON de outro formato ou de versão desconhecida', () => {
    expect(() => lerTrabalho(JSON.stringify({ registros: [] }))).toThrow('Este arquivo não é um trabalho do Leitor de desligamentos.');
    const futuro = { ...JSON.parse(gerarTrabalho([], salvoEm)), versao: 99 };
    expect(() => lerTrabalho(JSON.stringify(futuro))).toThrow('versão 99');
  });

  it('aponta o registro e o campo com problema', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro(), registro()], salvoEm));
    conteudo.registros[1].cpf = 123;
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('Registro 2: campo "cpf" inválido.');
    conteudo.registros[1].cpf = '1';
    conteudo.registros[1].status = 'TALVEZ';
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('Registro 2: campo "status" inválido.');
    conteudo.registros[1].status = 'OK';
    conteudo.registros[1].validado = 'sim';
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('Registro 2: campo "validado" inválido.');
  });

  it('ignora chaves desconhecidas e não deixa __proto__ contaminar objetos', () => {
    const texto = gerarTrabalho([registro()], salvoEm).replace('"arquivo":', '"__proto__":{"poluido":true},"extra":1,"arquivo":');
    const lido = lerTrabalho(texto).registros[0];
    expect(lido).not.toHaveProperty('extra');
    expect(({} as { poluido?: boolean }).poluido).toBeUndefined();
    expect(Object.getPrototypeOf(lido)).toBe(Object.prototype);
  });

  it('recusa trabalho com registros demais', () => {
    const muitos = Array.from({ length: 5001 }, (_, i) => registro({ id: i + 1 }));
    expect(() => lerTrabalho(gerarTrabalho(muitos, salvoEm))).toThrow('mais de 5000 registros');
  });

  it('nomeia o arquivo com a data', () => {
    expect(nomeDoArquivoDeTrabalho(new Date(2026, 0, 5))).toBe('trabalho-desligamentos-2026-01-05.json');
  });
});
