import { carregarPdfjs } from './carregarPdfjs';
import { montarLinhas, type ItemTexto } from './montarLinhas';

/** Erro de limite (tamanho, páginas, tempo): vira uma pendência legível, não um "erro de processamento". */
export class LimiteExcedido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'LimiteExcedido';
  }
}

export interface OpcoesDeLeitura {
  /** Acima disso o PDF é recusado sem ler as páginas. */
  maxPaginas?: number;
  /** Interrompe a leitura (por exemplo, por tempo); o erro lançado é o motivo do sinal. */
  signal?: AbortSignal;
}

function quandoAbortar(signal: AbortSignal): Promise<never> {
  return new Promise((_, rejeitar) => {
    if (signal.aborted) rejeitar(signal.reason);
    else signal.addEventListener('abort', () => rejeitar(signal.reason), { once: true });
  });
}

export async function extrairTexto(pdf: ArrayBuffer, opcoes: OpcoesDeLeitura = {}): Promise<string> {
  const { maxPaginas, signal } = opcoes;
  if (signal?.aborted) throw signal.reason;
  const { getDocument } = await carregarPdfjs();
  // Defesa em profundidade: não carrega as fontes do PDF no navegador (só servem para desenhar a
  // página). O pdf.js 6 já não usa eval, e o CSP também o bloquearia.
  const tarefa = getDocument({ data: new Uint8Array(pdf), disableFontFace: true });

  async function ler(): Promise<string> {
    const documento = await tarefa.promise;
    if (maxPaginas !== undefined && documento.numPages > maxPaginas) {
      throw new LimiteExcedido(`PDF com mais de ${maxPaginas} páginas`);
    }
    const paginas: string[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const itens: ItemTexto[] = [];
      for (const item of conteudo.items) {
        if ('str' in item) {
          itens.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            largura: item.width,
            altura: item.height,
          });
        }
      }
      paginas.push(montarLinhas(itens));
    }
    return paginas.join('\n');
  }

  try {
    return await (signal ? Promise.race([ler(), quandoAbortar(signal)]) : ler());
  } finally {
    await tarefa.destroy();
  }
}
