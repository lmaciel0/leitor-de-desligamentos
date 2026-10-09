import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../../tipos';
import { inconsistencies, parseText, recalcular, statusFor } from './campos';

const TEXTO = [
  'MUNICÍPIO: CIDADE EXEMPLO',
  'CPF: 001.234.567-89',
  'NIS: 000123456789',
  'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA',
  'MOTIVO DO DESLIGAMENTO',
  '( ) Mudança para outro Estado',
  '(X) OUTRO',
  'Mudança de renda da família',
].join('\n');

describe('parseText', () => {
  it('preserva identificadores e monta o motivo "OUTRO"', () => {
    const campos = parseText(TEXTO);
    expect(campos).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456789',
      nis: '000123456789',
      nome: 'MARIA DA SILVA',
      motivo: 'OUTRO: Mudança de renda da família',
    });
    expect(statusFor(campos)).toBe('OK');
  });

  it('aceita quebras de linha CRLF', () => {
    expect(parseText(TEXTO.replace(/\n/g, '\r\n'))).toEqual(parseText(TEXTO));
  });

  it('remove o número no final do município', () => {
    expect(parseText('MUNICÍPIO: CIDADE EXEMPLO 12').municipio).toBe('CIDADE EXEMPLO');
  });

  it('remove ruído numérico no final do nome', () => {
    const texto = 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA 123';
    expect(parseText(texto).nome).toBe('MARIA DA SILVA');
    expect(parseText('NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA(2)').nome).toBe('ANA');
  });

  it('usa a linha seguinte quando o valor não está na linha do rótulo', () => {
    const texto = 'CPF:\n\n   \n123.456.789-09';
    expect(parseText(texto).cpf).toBe('12345678909');
  });

  it('limita o CPF aos 11 primeiros dígitos', () => {
    expect(parseText('CPF: 123.456.789-0999').cpf).toBe('12345678909');
  });

  it('devolve o motivo marcado quando não é "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Mudança para outro Estado\n( ) OUTRO';
    expect(parseText(texto).motivo).toBe('Mudança para outro Estado');
  });

  it('pula caixas de marcação ao procurar o detalhe de "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Outro\n( ) Mudança\nDetalhe aqui';
    expect(parseText(texto).motivo).toBe('Outro: Detalhe aqui');
  });

  it('ignora marcações depois do fim da seção de motivo', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n( ) Mudança\nASSINATURA\n(X) OUTRO\nfoo';
    expect(parseText(texto).motivo).toBe('');
  });

  it('devolve todos os campos vazios para texto vazio', () => {
    const campos = parseText('');
    expect(campos).toEqual({ municipio: '', cpf: '', nis: '', nome: '', motivo: '' });
    expect(inconsistencies(campos)).toEqual(['MUNICIPIO', 'CPF', 'NIS', 'NOME', 'MOTIVO']);
  });
});

describe('inconsistencies e statusFor', () => {
  const completo = { municipio: 'OUTRA CIDADE', cpf: '12345678909', nis: '123', nome: 'ANA', motivo: 'Mudança' };

  it('campo ausente exige revisão', () => {
    const campos = { ...completo, municipio: '', nis: '', nome: '', motivo: '', cpf: '123' };
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('CPF com tamanho diferente de 11 gera "CPF inválido" mesmo com os outros campos preenchidos', () => {
    const campos = { ...completo, cpf: '1234567890' };
    expect(inconsistencies(campos)).toContain('CPF inválido');
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('registro completo fica OK', () => {
    expect(inconsistencies(completo)).toEqual([]);
    expect(statusFor(completo)).toBe('OK');
  });
});

describe('recalcular', () => {
  it('troca status e inconsistências depois de uma edição', () => {
    const registro: DesligamentoRecord = {
      id: 1,
      arquivo: 'a.pdf',
      referencia: '09/10/2026',
      municipio: '',
      cpf: '12345678909',
      nis: '123',
      nome: 'ANA',
      motivo: 'Mudança',
      status: 'REVISAR',
      inconsistencias: ['PDF sem texto selecionável (escaneado)'],
    };
    const corrigido = recalcular({ ...registro, municipio: 'CIDADE' });
    expect(corrigido.status).toBe('OK');
    expect(corrigido.inconsistencias).toEqual([]);
    expect(recalcular(registro).inconsistencias).toEqual(['MUNICIPIO']);
  });
});
