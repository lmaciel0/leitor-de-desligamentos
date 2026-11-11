import { afterEach, describe, expect, it } from 'vitest';
import { guardarImagem, limparImagens, MAX_IMAGENS_EM_MEMORIA, obterImagem } from './imagens';

afterEach(() => limparImagens());

describe('imagens em memória', () => {
  it('guarda e devolve a imagem pelo id do registro', () => {
    guardarImagem(1, 'data:image/jpeg;base64,AAA');
    expect(obterImagem(1)).toBe('data:image/jpeg;base64,AAA');
  });

  it('id desconhecido não tem imagem', () => {
    expect(obterImagem(42)).toBeUndefined();
  });

  it('ao passar do limite, descarta a imagem mais antiga', () => {
    for (let id = 1; id <= MAX_IMAGENS_EM_MEMORIA + 1; id++) guardarImagem(id, `imagem-${id}`);
    expect(obterImagem(1)).toBeUndefined();
    expect(obterImagem(2)).toBe('imagem-2');
    expect(obterImagem(MAX_IMAGENS_EM_MEMORIA + 1)).toBe(`imagem-${MAX_IMAGENS_EM_MEMORIA + 1}`);
  });

  it('guardar de novo o mesmo id troca a imagem e a torna a mais recente', () => {
    guardarImagem(1, 'velha');
    for (let id = 2; id <= MAX_IMAGENS_EM_MEMORIA; id++) guardarImagem(id, `imagem-${id}`);
    guardarImagem(1, 'nova');
    guardarImagem(MAX_IMAGENS_EM_MEMORIA + 1, 'ultima');
    expect(obterImagem(1)).toBe('nova');
    expect(obterImagem(2)).toBeUndefined();
  });

  it('limparImagens esvazia a memória', () => {
    guardarImagem(1, 'a');
    guardarImagem(2, 'b');
    limparImagens();
    expect(obterImagem(1)).toBeUndefined();
    expect(obterImagem(2)).toBeUndefined();
  });
});
