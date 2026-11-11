/**
 * Avisos que só fazem sentido para texto vindo de OCR: o texto digital do PDF
 * não erra letra nem marcador, o reconhecimento de imagem erra.
 */

const FLAGS = 'iu';
const ROTULO_RESPONSAVEL = /NOME\s+DO\s+RESPONS[AÁ]VEL\s+FAMILIAR\s*\(RF\)\s*A\s+SER\s+DESLIGADO\s*:\s*([^\r\n]*)/iu;
const ROTULO_CARTAO = /NOME\s+NO\s+CART[AÃ]O\s+CMIC\s*:\s*([^\r\n]*)/iu;
const TITULO_MOTIVO = /MOTIVO\s+DO\s+DESLIGAMENTO/iu;
const FIM_MOTIVO = /DATA\s+EM\s+QUE\s+SAIU/iu;
const MARCADOR = /\(\s*[xX]\s*\)/gu;
const DATA = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/u;
const ACENTOS = /\p{M}/gu;
const ESPACOS = /\s+/gu;

const ROTULOS_DE_DATA: ReadonlyArray<{ nome: string; padrao: string }> = [
  { nome: 'DATA NASC.', padrao: 'DATA\\s+NASC\\.?' },
  { nome: 'DATA DA ÚLTIMA ATUALIZAÇÃO', padrao: 'DATA\\s+DA\\s+[UÚ]LTIMA\\s+ATUALIZA[CÇ][AÃ]O' },
  { nome: 'DATA DA VALIDAÇÃO CMIC', padrao: 'DATA\\s+DA\\s+VALIDA[CÇ][AÃ]O\\s+CMIC' },
  { nome: 'DATA EM QUE SAIU DO PERFIL DO CMIC', padrao: 'DATA\\s+EM\\s+QUE\\s+SAIU\\s+DO\\s+PERFIL\\s+DO\\s+CMIC' },
];

function comparavel(nome: string): string {
  return nome.normalize('NFD').replace(ACENTOS, '').replace(ESPACOS, ' ').trim().toLowerCase();
}

function dataExiste(dia: number, mes: number, ano: number): boolean {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function avisoDeNome(texto: string): string[] {
  const responsavel = ROTULO_RESPONSAVEL.exec(texto)?.[1];
  const cartao = ROTULO_CARTAO.exec(texto)?.[1];
  if (!responsavel || !cartao) return [];
  return comparavel(responsavel) === comparavel(cartao) ? [] : ['Nome no cartão CMIC difere do nome do responsável'];
}

function avisosDeData(texto: string): string[] {
  const avisos: string[] = [];
  for (const { nome, padrao } of ROTULOS_DE_DATA) {
    const valor = new RegExp(`${padrao}\\s*:\\s*([^\\r\\n]*)`, FLAGS).exec(texto)?.[1];
    const data = valor ? DATA.exec(valor) : null;
    if (data && !dataExiste(Number(data[1]), Number(data[2]), Number(data[3]))) avisos.push(`Data inválida: ${nome}`);
  }
  return avisos;
}

function avisoDeMotivo(texto: string): string[] {
  const titulo = TITULO_MOTIVO.exec(texto);
  if (!titulo) return [];
  const resto = texto.slice(titulo.index + titulo[0].length);
  const fim = FIM_MOTIVO.exec(resto);
  const marcados = (fim ? resto.slice(0, fim.index) : resto).match(MARCADOR)?.length ?? 0;
  if (marcados === 0) return ['Nenhum motivo de desligamento marcado'];
  return marcados > 1 ? ['Mais de um motivo de desligamento marcado'] : [];
}

export function avisosDeLeitura(texto: string): string[] {
  const entrada = texto ?? '';
  return [...avisoDeNome(entrada), ...avisosDeData(entrada), ...avisoDeMotivo(entrada)];
}
