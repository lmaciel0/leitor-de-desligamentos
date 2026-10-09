import {
  CAMPOS_EDITAVEIS,
  type CampoEditavel,
  type CamposDesligamento,
  type DesligamentoRecord,
  type Status,
} from '../../tipos';

/**
 * Extração dos campos dos formulários de desligamento.
 * Port de FieldParser.java (mesmos rótulos e mensagens), com as correções
 * descobertas nos formulários reais: nome em duas linhas, NIB, CPF sem corte
 * e "OUTRO" sem detalhe.
 */

const FLAGS = 'iu';
const QUEBRA_DE_LINHA = /\r\n|\r|\n/;
const TOKEN = /[\wÀ-ÿ]+|\([^)]*\)/gu;

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function padraoDoRotulo(rotulo: string): string {
  return (rotulo.match(TOKEN) ?? []).map(escaparRegex).join('\\s+');
}

const ROTULO_NOME = new RegExp(
  `${padraoDoRotulo('NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO')}\\s*:\\s*([^\\r\\n]*)`,
  FLAGS,
);
const NIB = /NIB\s*:\s*(\d[\d.-]*)/iu;
const TITULO_MOTIVO = /MOTIVO\s+DO\s+DESLIGAMENTO/iu;
const FIM_MOTIVO = /\n\s*(?:ASSINATURA|OBSERVA[CÇ]ÕES?|DATA\s*:|DATA\s+EM\s+QUE|MUNIC[IÍ]PIO\s*:)/iu;
const CAIXA_MARCADA = /\(\s*[xX]\s*\)/u;
const CAIXA_MARCADA_TODAS = /\(\s*[xX]\s*\)/gu;
const QUALQUER_CAIXA = /\(\s*[xX ]\s*\)/u;
const RUIDO_FINAL_DO_NOME = /[\d()-]+$/u;
const NUMERO_FINAL_DO_MUNICIPIO = /\s+\d+\s*$/u;
const NAO_DIGITOS = /\D/gu;
const SUBLINHADOS = /_+/gu;

/** Linha que só tem letras: candidata a continuar um nome que quebrou. */
const CONTINUACAO_DE_NOME = /^\p{L}[\p{L}' .-]*$/u;
/** Rótulos do formulário que nunca fazem parte de um nome. */
const ROTULO_CONHECIDO = /^(?:NOME|DATA|CPF|NIS|NIB|MOTIVO|MUNIC[IÍ]PIO|ENDERE[CÇ]O|CADASTRO)\b/iu;
const MAXIMO_DE_LINHAS_DE_CONTINUACAO = 2;

function aparar(valor: string, caracteres: string): string {
  let inicio = 0;
  let fim = valor.length;
  while (inicio < fim && caracteres.includes(valor[inicio])) inicio++;
  while (fim > inicio && caracteres.includes(valor[fim - 1])) fim--;
  return valor.slice(inicio, fim);
}

function limpar(valor: string | null | undefined): string {
  if (!valor) return '';
  return aparar(valor.replace(/\s+/gu, ' '), ' \t:;');
}

function primeiraLinhaPreenchida(resto: string, tratar: (linha: string) => string): string {
  for (const linha of resto.split(QUEBRA_DE_LINHA)) {
    const valor = tratar(limpar(linha));
    if (valor) return valor;
  }
  return '';
}

function valorAposRotulo(texto: string, rotulo: string): string {
  const achado = new RegExp(`${rotulo}\\s*:\\s*([^\\r\\n]*)`, FLAGS).exec(texto);
  if (!achado) return '';
  const valor = limpar(achado[1]);
  if (valor) return valor;
  return primeiraLinhaPreenchida(texto.slice(achado.index + achado[0].length), (linha) => linha);
}

function apenasDigitos(valor: string): string {
  return valor.replace(NAO_DIGITOS, '');
}

function sanitizarNome(valor: string): string {
  return valor.replace(RUIDO_FINAL_DO_NOME, '').trim();
}

function extrairNome(texto: string): string {
  const achado = ROTULO_NOME.exec(texto);
  if (!achado) return '';
  const resto = texto.slice(achado.index + achado[0].length);
  let nome = sanitizarNome(limpar(achado[1]));
  if (!nome) return primeiraLinhaPreenchida(resto, sanitizarNome);
  // O nome pode quebrar em mais de uma linha (célula estreita do formulário).
  const seguintes = resto.split(QUEBRA_DE_LINHA).slice(1);
  for (const linha of seguintes.slice(0, MAXIMO_DE_LINHAS_DE_CONTINUACAO)) {
    const candidata = limpar(linha);
    if (!CONTINUACAO_DE_NOME.test(candidata) || ROTULO_CONHECIDO.test(candidata)) break;
    nome = `${nome} ${candidata}`;
  }
  return nome;
}

function extrairNib(texto: string): string {
  const achado = NIB.exec(texto);
  return achado ? apenasDigitos(achado[1]) : '';
}

function extrairMotivo(texto: string): string {
  const titulo = TITULO_MOTIVO.exec(texto);
  if (!titulo) return '';
  const resto = texto.slice(titulo.index + titulo[0].length);
  const fim = FIM_MOTIVO.exec(resto);
  const secao = fim ? resto.slice(0, fim.index) : resto;
  const linhas = secao.split(QUEBRA_DE_LINHA);
  for (let indice = 0; indice < linhas.length; indice++) {
    if (!CAIXA_MARCADA.test(linhas[indice])) continue;
    const motivo = limpar(linhas[indice].replace(CAIXA_MARCADA_TODAS, ''));
    if (!motivo) continue;
    if (motivo.slice(0, 5).toLowerCase() !== 'outro') return motivo;
    return motivoOutro(motivo.slice(0, 5), motivo.slice(5), linhas.slice(indice + 1));
  }
  return '';
}

/** "OUTRO": o detalhe vem na mesma linha (sobre os sublinhados) ou numa linha seguinte; sem detalhe, fica só "OUTRO". */
function motivoOutro(palavra: string, restoDaLinha: string, linhasSeguintes: string[]): string {
  const naLinha = limpar(restoDaLinha.replace(SUBLINHADOS, ' '));
  if (naLinha) return `${palavra}: ${naLinha}`;
  for (const linha of linhasSeguintes) {
    const detalhe = limpar(linha.replace(SUBLINHADOS, ' '));
    if (!detalhe || QUALQUER_CAIXA.test(detalhe)) continue;
    return `${palavra}: ${detalhe}`;
  }
  return palavra;
}

export function parseText(texto: string): CamposDesligamento {
  const entrada = texto ?? '';
  return {
    municipio: valorAposRotulo(entrada, 'MUNIC[IÍ]PIO').replace(NUMERO_FINAL_DO_MUNICIPIO, '').trim(),
    cpf: apenasDigitos(valorAposRotulo(entrada, 'CPF')),
    nis: apenasDigitos(valorAposRotulo(entrada, 'NIS')),
    nib: extrairNib(entrada),
    nome: extrairNome(entrada),
    motivo: extrairMotivo(entrada),
  };
}

/** Normaliza o valor digitado numa célula: CPF, NIS e NIB aceitam só dígitos. Um CPF com mais de 11 dígitos segue como digitado e é apontado em "CPF inválido". */
export function normalizarCampo(campo: CampoEditavel, valor: string): string {
  if (campo === 'cpf' || campo === 'nis' || campo === 'nib') return apenasDigitos(valor);
  return valor;
}

export function inconsistencies(campos: CamposDesligamento): string[] {
  const problemas = CAMPOS_EDITAVEIS.filter((campo) => !campos[campo]?.trim()).map((campo) => campo.toUpperCase());
  const cpf = campos.cpf?.trim() ?? '';
  if (cpf && cpf.length !== 11) problemas.push('CPF inválido');
  // O detalhe do OUTRO costuma ser manuscrito e não vem no texto do PDF: o usuário o digita.
  if (/^outro$/i.test(campos.motivo?.trim() ?? '')) problemas.push('Digite o detalhe do OUTRO');
  return problemas;
}

export function statusFor(campos: CamposDesligamento): Status {
  return inconsistencies(campos).length === 0 ? 'OK' : 'REVISAR';
}

/** Recalcula status e inconsistências a partir dos campos (usado depois de editar uma célula). */
export function recalcular(registro: DesligamentoRecord): DesligamentoRecord {
  const problemas = inconsistencies(registro);
  return { ...registro, inconsistencias: problemas, status: problemas.length === 0 ? 'OK' : 'REVISAR' };
}
