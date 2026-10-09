import { describe, expect, it } from 'vitest';
import { montarLinhas, type ItemTexto } from './montarLinhas';

function item(str: string, x: number, y: number, largura = str.length * 5, altura = 10): ItemTexto {
  return { str, x, y, largura, altura };
}

describe('montarLinhas', () => {
  it('ordena de cima para baixo e da esquerda para a direita, mesmo com itens fora de ordem', () => {
    const itens = [item('B2', 100, 700), item('A1', 10, 780), item('B1', 100, 780), item('A2', 10, 700)];
    expect(montarLinhas(itens)).toBe('A1 B1\nA2 B2');
  });

  it('trata Y levemente diferente como a mesma linha', () => {
    const itens = [item('CPF:', 10, 500), item('123', 100, 502.5)];
    expect(montarLinhas(itens)).toBe('CPF: 123');
  });

  it('separa linhas cujo Y difere mais que a tolerância', () => {
    const itens = [item('linha 1', 10, 500), item('linha 2', 10, 488)];
    expect(montarLinhas(itens)).toBe('linha 1\nlinha 2');
  });

  it('junta itens colados sem espaço e itens afastados com um espaço', () => {
    const colados = [item('CP', 10, 500, 10), item('F:', 20, 500, 10)];
    expect(montarLinhas(colados)).toBe('CPF:');
    const afastados = [item('CPF:', 10, 500, 20), item('123', 60, 500, 15)];
    expect(montarLinhas(afastados)).toBe('CPF: 123');
  });

  it('não duplica espaço quando o item já traz espaço', () => {
    const itens = [item('CPF: ', 10, 500, 25), item('123', 60, 500, 15)];
    expect(montarLinhas(itens)).toBe('CPF: 123');
  });

  it('ignora itens só com espaços e devolve vazio sem itens', () => {
    expect(montarLinhas([item('  ', 10, 500)])).toBe('');
    expect(montarLinhas([])).toBe('');
  });
});
