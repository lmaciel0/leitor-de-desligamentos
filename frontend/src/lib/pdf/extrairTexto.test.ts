import { describe, expect, it } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../../testes/criarPdf';
import { parseText } from '../parser/campos';
import { extrairTexto, LimiteExcedido } from './extrairTexto';

/** Formulário sintético: rótulos à esquerda, valores em outra coluna, desenhados fora de ordem. */
const FORMULARIO: TextoNaPagina[] = [
  { texto: 'Mudança de renda da família', x: 50, y: 640 },
  { texto: '(X) OUTRO', x: 50, y: 660 },
  { texto: '( ) Mudança para outro Estado', x: 50, y: 680 },
  { texto: 'MOTIVO DO DESLIGAMENTO', x: 50, y: 700 },
  { texto: 'MARIA DA SILVA', x: 400, y: 740 },
  { texto: 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO:', x: 50, y: 740 },
  { texto: '000123456789', x: 120, y: 760 },
  { texto: 'NIS:', x: 50, y: 760 },
  { texto: '0012345678', x: 120, y: 790 },
  { texto: 'NIB:', x: 50, y: 790 },
  { texto: '001.234.567-89', x: 120, y: 780 },
  { texto: 'CPF:', x: 50, y: 780 },
  { texto: 'CIDADE EXEMPLO', x: 120, y: 800 },
  { texto: 'MUNICÍPIO:', x: 50, y: 800 },
];

describe('extrairTexto', () => {
  it('reconstrói as linhas do formulário e o parser encontra todos os campos', async () => {
    const texto = await extrairTexto(await criarPdf([FORMULARIO]));
    expect(parseText(texto)).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456789',
      nis: '000123456789',
      nib: '0012345678',
      nome: 'MARIA DA SILVA',
      motivo: 'OUTRO: Mudança de renda da família',
    });
  });

  it('une as páginas na ordem', async () => {
    const texto = await extrairTexto(
      await criarPdf([[{ texto: 'PAGINA UM', x: 50, y: 800 }], [{ texto: 'PAGINA DOIS', x: 50, y: 800 }]]),
    );
    expect(texto).toBe('PAGINA UM\nPAGINA DOIS');
  });

  it('devolve texto vazio para PDF sem texto', async () => {
    expect((await extrairTexto(await criarPdf([[]]))).trim()).toBe('');
  });

  it('rejeita bytes que não são um PDF', async () => {
    await expect(extrairTexto(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow();
  });
});

describe('extrairTexto com limites', () => {
  it('recusa PDF com mais páginas que o limite', async () => {
    const onzePaginas = Array.from({ length: 11 }, (_, i) => [{ texto: `PAGINA ${i + 1}`, x: 50, y: 800 }]);
    await expect(extrairTexto(await criarPdf(onzePaginas), { maxPaginas: 10 })).rejects.toThrow('PDF com mais de 10 páginas');
    await expect(extrairTexto(await criarPdf(onzePaginas), { maxPaginas: 10 })).rejects.toBeInstanceOf(LimiteExcedido);
  });

  it('aceita PDF no limite exato de páginas', async () => {
    const dezPaginas = Array.from({ length: 10 }, (_, i) => [{ texto: `PAGINA ${i + 1}`, x: 50, y: 800 }]);
    expect(await extrairTexto(await criarPdf(dezPaginas), { maxPaginas: 10 })).toContain('PAGINA 10');
  });

  it('para a leitura quando o sinal é abortado, com o motivo do sinal', async () => {
    const motivo = new LimiteExcedido('parou');
    await expect(extrairTexto(await criarPdf([FORMULARIO]), { signal: AbortSignal.abort(motivo) })).rejects.toBe(motivo);
  });
});
