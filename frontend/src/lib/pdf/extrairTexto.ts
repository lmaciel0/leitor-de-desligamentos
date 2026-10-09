import { carregarPdfjs } from './carregarPdfjs';
import { montarLinhas, type ItemTexto } from './montarLinhas';

export async function extrairTexto(pdf: ArrayBuffer): Promise<string> {
  const { getDocument } = await carregarPdfjs();
  const tarefa = getDocument({ data: new Uint8Array(pdf) });
  try {
    const documento = await tarefa.promise;
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
  } finally {
    await tarefa.destroy();
  }
}
