/**
 * Imagens das páginas lidas por OCR, só em memória e só durante a sessão: não vão para o
 * arquivo de trabalho, para a exportação nem para o armazenamento do navegador.
 */

/** Limite de imagens guardadas no lote; ao passar dele, a mais antiga é descartada. */
export const MAX_IMAGENS_EM_MEMORIA = 30;

// O Map mantém a ordem de inserção: a primeira chave é a imagem mais antiga.
const imagens = new Map<number, string>();

export function guardarImagem(idDoRegistro: number, dataUrl: string): void {
  imagens.delete(idDoRegistro);
  imagens.set(idDoRegistro, dataUrl);
  while (imagens.size > MAX_IMAGENS_EM_MEMORIA) {
    const maisAntiga = imagens.keys().next().value;
    if (maisAntiga === undefined) break;
    imagens.delete(maisAntiga);
  }
}

export function obterImagem(idDoRegistro: number): string | undefined {
  return imagens.get(idDoRegistro);
}

export function limparImagens(): void {
  imagens.clear();
}
