/**
 * Limpa o texto devolvido pelo OCR antes de ir para o `parseText`.
 * Corrige só erros conhecidos de leitura e nunca mexe em dígitos dos dados:
 * o `1` de `N1S` é parte do rótulo, não de CPF, NIS, NIB ou data.
 */

// Rótulo do NIS lido errado (ex.: "Ints:", "N1S:"): 2 a 5 letras ou dígitos, com ao menos uma letra.
// Só vale logo depois de "NIB: <dígitos>" (com "|" opcional, preservado) e antes de 11 dígitos.
const ROTULO_NIS_APOS_NIB =
  /(\bNIB\s*:\s*\d[\d.-]*\s+\|?)(?=[\dA-Za-zÀ-ÿ]{0,4}[A-Za-zÀ-ÿ])[\dA-Za-zÀ-ÿ]{2,5}(\s*:\s*)(?=\d{11}(?!\d))/u;

// Caixa vazia lida como "(/ )": vira "( )". Marcas com traço ("(/x)", "(x/)") não casam.
const CAIXA_VAZIA_COM_BARRA = /\(\s*\/\s*\)/gu;

// Marcador de motivo com a barra no lugar do parêntese final, só no começo da linha.
const MARCADOR_COM_BARRA = /^(\(\s*[xX]\s*)\|/u;

const BARRAS_E_ESPACOS_NAS_BORDAS = /^[\s|]+|[\s|]+$/gu;

function normalizarLinha(linha: string): string {
  return linha
    .replace(BARRAS_E_ESPACOS_NAS_BORDAS, '')
    .replace(CAIXA_VAZIA_COM_BARRA, '( )')
    .replace(MARCADOR_COM_BARRA, '$1)')
    .replace(ROTULO_NIS_APOS_NIB, '$1NIS$2');
}

export function normalizarTextoOcr(texto: string): string {
  return texto.split('\n').map(normalizarLinha).join('\n');
}
