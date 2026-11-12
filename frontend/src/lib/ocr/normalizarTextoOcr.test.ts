import { describe, expect, it } from 'vitest';
import { parseText } from '../parser/campos';
import { normalizarTextoOcr } from './normalizarTextoOcr';

describe('normalizarTextoOcr', () => {
  it('corrige o rótulo NIS lido como Ints depois do NIB', () => {
    expect(normalizarTextoOcr('NIB: 0562977732 Ints: 20705987161')).toBe(
      'NIB: 0562977732 NIS: 20705987161',
    );
  });

  it('corrige o marcador de motivo lido como "( x |"', () => {
    expect(normalizarTextoOcr('| ( x | Mudança para outro Município;')).toBe(
      '( x ) Mudança para outro Município;',
    );
  });

  it('tira barras das bordas da linha', () => {
    expect(normalizarTextoOcr('| MUNICÍPIO: ARACATI - CE |')).toBe('MUNICÍPIO: ARACATI - CE');
  });

  it('mantém marcador vazio intacto', () => {
    expect(normalizarTextoOcr('( ) Processo de fiscalização; |')).toBe(
      '( ) Processo de fiscalização;',
    );
  });

  it('nunca altera dígitos', () => {
    expect(normalizarTextoOcr('CPF: 056.297.773-27')).toBe('CPF: 056.297.773-27');
  });

  it('deixa igual o texto sem erro conhecido', () => {
    const texto = 'NOME: MARIA DA SILVA\n( x ) Óbito;\nNIS: 20705987161';
    expect(normalizarTextoOcr(texto)).toBe(texto);
  });

  it('tira espaços sobrando nas bordas', () => {
    expect(normalizarTextoOcr('   NOME: MARIA   ')).toBe('NOME: MARIA');
  });

  it('processa várias linhas', () => {
    expect(normalizarTextoOcr('| NOME: ANA |\n| ( x | Óbito;\nNIB: 123 Ints: 20705987161')).toBe(
      'NOME: ANA\n( x ) Óbito;\nNIB: 123 NIS: 20705987161',
    );
  });

  it('não troca Ints fora de depois de um NIB', () => {
    expect(normalizarTextoOcr('Ints: 123')).toBe('Ints: 123');
    expect(normalizarTextoOcr('Ints: 20705987161')).toBe('Ints: 20705987161');
  });

  it('não troca "( x |" fora do início da linha', () => {
    expect(normalizarTextoOcr('texto ( x | outro')).toBe('texto ( x | outro');
  });

  it('troca a caixa vazia lida como (/ ) por ( )', () => {
    expect(normalizarTextoOcr('|(/ ) OUTRO: |')).toBe('( ) OUTRO:');
    expect(normalizarTextoOcr('1(/ ) Renda familiar mensal per capita superior;')).toBe(
      '1( ) Renda familiar mensal per capita superior;',
    );
    expect(normalizarTextoOcr('(/) Processo de fiscalização;')).toBe(
      '( ) Processo de fiscalização;',
    );
  });

  it('não mexe em marca com traço nem em caixa marcada', () => {
    for (const linha of [
      '(/x) Processo de fiscalização;',
      '(x/) Processo de fiscalização;',
      '( x) Mudança para outro Município;',
    ]) {
      expect(normalizarTextoOcr(linha)).toBe(linha);
    }
  });

  it('corrige o rótulo NIS lido com dígito depois do NIB', () => {
    expect(normalizarTextoOcr('NIB: 0562977732 N1S: 20705987161')).toBe(
      'NIB: 0562977732 NIS: 20705987161',
    );
    expect(normalizarTextoOcr('NIB: 0562977732 |N1S: 20705987161')).toBe(
      'NIB: 0562977732 |NIS: 20705987161',
    );
  });

  it('não troca rótulo só de dígitos nem NIS fora de 11 dígitos', () => {
    for (const linha of [
      'NIB: 0562977732 12: 20705987161',
      'NIB: 0562977732 N1S: 2070598716',
      'NIB: 0562977732 N1S: 207059871610',
    ]) {
      expect(normalizarTextoOcr(linha)).toBe(linha);
    }
  });

  it('motivo com caixas (/ ) continua sendo o marcado', () => {
    const bloco = [
      'MOTIVO DO DESLIGAMENTO:',
      '1(/ ) Renda familiar mensal per capita superior;',
      '|( x) Mudança para outro Município;',
      '|(/ ) OUTRO: |',
      'DATA EM QUE SAIU DO PERFIL DO CMIC: 24/04/2026',
    ].join('\n');
    expect(parseText(normalizarTextoOcr(bloco)).motivo).toBe('Mudança para outro Município');
  });
});
