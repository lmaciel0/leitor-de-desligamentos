import { describe, expect, it } from 'vitest';
import { LimiteExcedido } from '../pdf/extrairTexto';
import {
  ALTURA_MAXIMA_DA_MINIATURA,
  escalaDoOcr,
  LARGURA_MAXIMA_DA_MINIATURA,
  MAX_LADO_DO_CANVAS,
  MAX_PIXELS_DO_CANVAS,
  tamanhoDaMiniatura,
} from './rasterizar';

const A_300_DPI = 300 / 72;

/** Tamanho do canvas que a escala gera (como `renderizar` arredonda). */
function canvasDe(largura: number, altura: number) {
  const escala = escalaDoOcr(largura, altura);
  return { largura: Math.floor(largura * escala), altura: Math.floor(altura * escala) };
}

describe('escalaDoOcr', () => {
  it('página A4 é lida a 300 dpi', () => {
    expect(escalaDoOcr(595, 842)).toBe(A_300_DPI);
  });

  it('página grande demais para 300 dpi fica dentro do teto de pixels', () => {
    const { largura, altura } = canvasDe(5000, 5000);
    expect(largura * altura).toBeLessThanOrEqual(MAX_PIXELS_DO_CANVAS);
    expect(escalaDoOcr(5000, 5000)).toBeLessThan(A_300_DPI);
  });

  it('página estreita e comprida fica dentro do teto de lado', () => {
    const { largura, altura } = canvasDe(100, 14_000);
    expect(altura).toBeLessThanOrEqual(MAX_LADO_DO_CANVAS);
    expect(largura * altura).toBeLessThanOrEqual(MAX_PIXELS_DO_CANVAS);
  });

  it('a maior página que o PDF permite (200 polegadas) ainda é aceita, reduzida', () => {
    const { largura, altura } = canvasDe(14_400, 14_400);
    expect(Math.max(largura, altura)).toBeLessThanOrEqual(MAX_LADO_DO_CANVAS);
    expect(largura * altura).toBeLessThanOrEqual(MAX_PIXELS_DO_CANVAS);
  });

  it.each([
    ['maior que o PDF permite', 20_000, 842],
    ['sem largura', 0, 842],
    ['com medida negativa', 595, -842],
    ['com medida que não é número', Number.NaN, 842],
    ['infinita', Number.POSITIVE_INFINITY, 842],
    ['fina demais para virar um pixel', 0.01, 842],
  ])('recusa página %s', (_caso, largura, altura) => {
    expect(() => escalaDoOcr(largura, altura)).toThrow(LimiteExcedido);
    expect(() => escalaDoOcr(largura, altura)).toThrow('PDF com página de tamanho inválido');
  });
});

describe('tamanhoDaMiniatura', () => {
  it('página A4 a 300 dpi vira 900 px de largura, na proporção', () => {
    expect(tamanhoDaMiniatura(2479, 3508)).toEqual({ largura: 900, altura: 1274 });
  });

  it('página pequena não é ampliada', () => {
    expect(tamanhoDaMiniatura(600, 800)).toEqual({ largura: 600, altura: 800 });
  });

  it('página estreita e comprida também tem a altura limitada', () => {
    const { largura, altura } = tamanhoDaMiniatura(300, 10_000);
    expect(altura).toBe(ALTURA_MAXIMA_DA_MINIATURA);
    expect(largura).toBeLessThanOrEqual(LARGURA_MAXIMA_DA_MINIATURA);
    expect(largura).toBeGreaterThanOrEqual(1);
  });

  it('nunca gera canvas de 0 px', () => {
    expect(tamanhoDaMiniatura(1, 10_000)).toEqual({ largura: 1, altura: ALTURA_MAXIMA_DA_MINIATURA });
  });
});
