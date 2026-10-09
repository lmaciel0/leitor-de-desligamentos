import { describe, expect, it } from 'vitest';
import { ehPdf, separarDuplicados } from './arquivos';

const arquivo = (nome: string, conteudo: string, tipo = 'application/pdf') => new File([conteudo], nome, { type: tipo });

describe('ehPdf', () => {
  it('aceita pelo tipo ou pela extensão, sem diferenciar maiúsculas', () => {
    expect(ehPdf(arquivo('a.pdf', 'x'))).toBe(true);
    expect(ehPdf(arquivo('A.PDF', 'x', ''))).toBe(true);
    expect(ehPdf(arquivo('sem-extensao', 'x', 'application/pdf'))).toBe(true);
  });

  it('recusa o que não é PDF', () => {
    expect(ehPdf(arquivo('nota.txt', 'x', 'text/plain'))).toBe(false);
    expect(ehPdf(arquivo('foto.png', 'x', 'image/png'))).toBe(false);
  });
});

describe('separarDuplicados', () => {
  it('trata como repetido o arquivo com o mesmo conteúdo, mesmo com outro nome', async () => {
    const original = arquivo('form.pdf', 'conteudo A');
    const copia = arquivo('form (1).pdf', 'conteudo A');
    const { aceitos, repetidos } = await separarDuplicados([original], [copia]);
    expect(aceitos).toEqual([]);
    expect(repetidos.map((f) => f.name)).toEqual(['form (1).pdf']);
  });

  it('mantém só o primeiro quando o mesmo conteúdo chega duas vezes no mesmo lote', async () => {
    const lote = [arquivo('a.pdf', 'X'), arquivo('b.pdf', 'Y'), arquivo('c.pdf', 'X')];
    const { aceitos, repetidos } = await separarDuplicados([], lote);
    expect(aceitos.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(repetidos.map((f) => f.name)).toEqual(['c.pdf']);
  });

  it('aceita arquivos com o mesmo nome mas conteúdo diferente', async () => {
    const { aceitos, repetidos } = await separarDuplicados([arquivo('a.pdf', 'um')], [arquivo('a.pdf', 'dois')]);
    expect(aceitos).toHaveLength(1);
    expect(repetidos).toEqual([]);
  });

  it('o mesmo objeto File adicionado de novo é repetido', async () => {
    const f = arquivo('a.pdf', 'um');
    const { aceitos, repetidos } = await separarDuplicados([f], [f]);
    expect(aceitos).toEqual([]);
    expect(repetidos).toEqual([f]);
  });

  it('sem arquivos novos, devolve listas vazias', async () => {
    expect(await separarDuplicados([arquivo('a.pdf', 'x')], [])).toEqual({ aceitos: [], repetidos: [] });
  });
});
