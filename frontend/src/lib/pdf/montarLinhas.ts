/**
 * O pdf.js devolve fragmentos de texto com coordenadas, sem quebras de linha.
 * O parser depende de linhas (por exemplo, o valor de um rótulo pode estar na
 * linha seguinte), então reconstruímos as linhas pela posição vertical.
 */
export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Fração da altura da fonte tolerada entre itens da mesma linha. */
const TOLERANCIA_VERTICAL = 0.5;
/** Fração da altura da fonte a partir da qual um intervalo conta como espaço. */
const INTERVALO_DE_ESPACO = 0.15;

function altura(item: ItemTexto): number {
  return Math.max(item.altura, 1);
}

function agruparPorLinha(itens: ItemTexto[]): ItemTexto[][] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y);
  const linhas: ItemTexto[][] = [];
  for (const item of ordenados) {
    const atual = linhas[linhas.length - 1];
    if (atual && Math.abs(atual[0].y - item.y) <= altura(atual[0]) * TOLERANCIA_VERTICAL) {
      atual.push(item);
    } else {
      linhas.push([item]);
    }
  }
  return linhas;
}

function juntarLinha(linha: ItemTexto[]): string {
  const ordenada = [...linha].sort((a, b) => a.x - b.x);
  let texto = '';
  let anterior: ItemTexto | undefined;
  for (const item of ordenada) {
    if (anterior) {
      const intervalo = item.x - (anterior.x + anterior.largura);
      const temEspaco = texto.endsWith(' ') || item.str.startsWith(' ');
      if (!temEspaco && intervalo > altura(item) * INTERVALO_DE_ESPACO) texto += ' ';
    }
    texto += item.str;
    anterior = item;
  }
  return texto;
}

export function montarLinhas(itens: ItemTexto[]): string {
  const comTexto = itens.filter((item) => item.str.trim() !== '');
  return agruparPorLinha(comTexto).map(juntarLinha).join('\n');
}
