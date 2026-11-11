/**
 * Limpa o texto devolvido pelo OCR antes de ir para o `parseText`.
 * Corrige só erros conhecidos de leitura e nunca mexe em dígitos.
 */

// Rótulo do NIS lido errado (ex.: "Ints:"): só vale logo depois de "NIB: <dígitos>" e antes de 11 dígitos.
const ROTULO_NIS_APOS_NIB = /(\bNIB\s*:\s*\d[\d.-]*\s+)[A-Za-zÀ-ÿ]{2,5}(\s*:\s*)(?=\d{11}(?!\d))/u;

// Marcador de motivo com a barra no lugar do parêntese final, só no começo da linha.
const MARCADOR_COM_BARRA = /^(\(\s*[xX]\s*)\|/u;

const BARRAS_E_ESPACOS_NAS_BORDAS = /^[\s|]+|[\s|]+$/gu;

function normalizarLinha(linha: string): string {
  return linha
    .replace(BARRAS_E_ESPACOS_NAS_BORDAS, '')
    .replace(MARCADOR_COM_BARRA, '$1)')
    .replace(ROTULO_NIS_APOS_NIB, '$1NIS$2');
}

export function normalizarTextoOcr(texto: string): string {
  return texto.split('\n').map(normalizarLinha).join('\n');
}
