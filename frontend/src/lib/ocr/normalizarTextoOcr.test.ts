import { describe, expect, it } from 'vitest';
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
});
