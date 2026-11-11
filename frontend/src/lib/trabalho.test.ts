import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../tipos';
import { PENDENCIA_OCR } from './parser/campos';
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
    expect(conteudo.versao).toBe(2);
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

  it('recalcula o status ao abrir: um registro salvo como OK com CPF vazio volta como REVISAR', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro()], salvoEm));
    conteudo.registros[0].cpf = '';
    const lido = lerTrabalho(JSON.stringify(conteudo)).registros[0];
    expect(lido.status).toBe('REVISAR');
    expect(lido.inconsistencias).toEqual(['CPF']);
  });

  it('recalcula o status ao abrir: REVISAR sem nenhuma pendência volta como OK', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro({ status: 'REVISAR', inconsistencias: [] })], salvoEm));
    expect(lerTrabalho(JSON.stringify(conteudo)).registros[0].status).toBe('OK');
  });

  it('mantém as pendências da leitura do PDF, que não dá para recalcular', () => {
    const vazio = registro({ municipio: '', cpf: '', nis: '', nib: '', nome: '', motivo: '', status: 'REVISAR', inconsistencias: ['PDF maior que 20 MB'] });
    const lido = lerTrabalho(gerarTrabalho([vazio], salvoEm)).registros[0];
    expect(lido.inconsistencias).toEqual(['PDF maior que 20 MB', 'MUNICIPIO', 'CPF', 'NIS', 'NIB', 'NOME', 'MOTIVO']);
  });

  it('recusa textos e listas de pendências grandes demais', () => {
    expect(() => lerTrabalho(gerarTrabalho([registro({ nome: 'A'.repeat(1001) })], salvoEm))).toThrow(
      'Registro 1: campo "nome" grande demais.',
    );
    const muitas = Array.from({ length: 51 }, (_, i) => `PDF problema ${i}`);
    expect(() => lerTrabalho(gerarTrabalho([registro({ inconsistencias: muitas })], salvoEm))).toThrow(
      'Registro 1: campo "inconsistencias" grande demais.',
    );
  });

  it('recusa trabalho com registros demais', () => {
    const muitos = Array.from({ length: 5001 }, (_, i) => registro({ id: i + 1 }));
    expect(() => lerTrabalho(gerarTrabalho(muitos, salvoEm))).toThrow('mais de 5000 registros');
  });

  it('preserva revisarNoLote: true num registro hoje OK', () => {
    const lido = lerTrabalho(gerarTrabalho([registro({ revisarNoLote: true })], salvoEm)).registros[0];
    expect(lido.status).toBe('OK');
    expect(lido.revisarNoLote).toBe(true);
  });

  it('recusa revisarNoLote que não é booleano', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro()], salvoEm));
    conteudo.registros[0].revisarNoLote = 'sim';
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('Registro 1: campo "revisarNoLote" inválido.');
  });

  it('abre sem a chave revisarNoLote quando o arquivo não a tem, e continua na versão 2', () => {
    const texto = gerarTrabalho([registro()], salvoEm);
    expect(JSON.parse(texto).versao).toBe(2);
    expect('revisarNoLote' in lerTrabalho(texto).registros[0]).toBe(false);
  });

  it('abre um trabalho da versão 1, sem a marca de OCR', () => {
    const conteudo = { ...JSON.parse(gerarTrabalho([registro()], salvoEm)), versao: 1 };
    const lido = lerTrabalho(JSON.stringify(conteudo)).registros[0];
    expect(lido.lidoPorOcr).toBeUndefined();
    expect(lido.avisosOcr).toBeUndefined();
    expect(lido.status).toBe('OK');
  });

  it('recusa a versão 3', () => {
    const futuro = { ...JSON.parse(gerarTrabalho([], salvoEm)), versao: 3 };
    expect(() => lerTrabalho(JSON.stringify(futuro))).toThrow('versão 3');
  });

  it('round-trip de registro de OCR: marca, avisos e a pendência de OCR uma única vez', () => {
    const ocr = registro({
      lidoPorOcr: true,
      avisosOcr: ['Mais de um motivo de desligamento marcado'],
      status: 'REVISAR',
      inconsistencias: [PENDENCIA_OCR, 'Mais de um motivo de desligamento marcado'],
    });
    const lido = lerTrabalho(gerarTrabalho([ocr], salvoEm)).registros[0];
    expect(lido.lidoPorOcr).toBe(true);
    expect(lido.avisosOcr).toEqual(['Mais de um motivo de desligamento marcado']);
    expect(lido.status).toBe('REVISAR');
    expect(lido.inconsistencias.filter((p) => p === PENDENCIA_OCR)).toHaveLength(1);
    expect(lido.inconsistencias).toContain('Mais de um motivo de desligamento marcado');
  });

  it('registro de OCR editado à mão para OK sem validar volta como REVISAR', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro({ lidoPorOcr: true })], salvoEm));
    conteudo.registros[0].status = 'OK';
    conteudo.registros[0].inconsistencias = [];
    const lido = lerTrabalho(JSON.stringify(conteudo)).registros[0];
    expect(lido.status).toBe('REVISAR');
    expect(lido.inconsistencias).toContain(PENDENCIA_OCR);
  });

  it('registro sem a marca de OCR, mas com a pendência de OCR (editado à mão), abre como registro de OCR', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro({ lidoPorOcr: true, inconsistencias: [PENDENCIA_OCR] })], salvoEm));
    delete conteudo.registros[0].lidoPorOcr;
    conteudo.registros[0].status = 'OK';
    const lido = lerTrabalho(JSON.stringify(conteudo)).registros[0];
    expect(lido.lidoPorOcr).toBe(true);
    expect(lido.status).toBe('REVISAR');
    expect(lido.inconsistencias.filter((p) => p === PENDENCIA_OCR)).toHaveLength(1);
  });

  it('marca de OCR explicitamente falsa prevalece sobre a pendência de OCR', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro({ lidoPorOcr: false, inconsistencias: [PENDENCIA_OCR] })], salvoEm));
    const lido = lerTrabalho(JSON.stringify(conteudo)).registros[0];
    expect(lido.lidoPorOcr).toBe(false);
    expect(lido.status).toBe('OK');
    expect(lido.inconsistencias).toEqual([]);
  });

  it('registro de OCR validado abre como OK', () => {
    const lido = lerTrabalho(gerarTrabalho([registro({ lidoPorOcr: true, validado: true })], salvoEm)).registros[0];
    expect(lido.status).toBe('OK');
    expect(lido.inconsistencias).toEqual([]);
  });

  it('recusa lidoPorOcr e avisosOcr inválidos, citando o campo', () => {
    const conteudo = JSON.parse(gerarTrabalho([registro({ lidoPorOcr: true })], salvoEm));
    conteudo.registros[0].lidoPorOcr = 'sim';
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('campo "lidoPorOcr" inválido');
    conteudo.registros[0].lidoPorOcr = true;
    conteudo.registros[0].avisosOcr = 'aviso';
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('campo "avisosOcr" inválido');
    conteudo.registros[0].avisosOcr = [1];
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('campo "avisosOcr" inválido');
    conteudo.registros[0].avisosOcr = Array.from({ length: 51 }, (_, i) => `aviso ${i}`);
    expect(() => lerTrabalho(JSON.stringify(conteudo))).toThrow('campo "avisosOcr" grande demais');
  });

  it('nomeia o arquivo com a data', () => {
    expect(nomeDoArquivoDeTrabalho(new Date(2026, 0, 5))).toBe('trabalho-desligamentos-2026-01-05.json');
  });
});
