import {
  CAMPOS_EDITAVEIS,
  type CampoEditavel,
  type CamposDesligamento,
  type DesligamentoRecord,
  type Status,
} from '../../tipos';

/**
 * Extração dos campos dos formulários de desligamento.
 * Port fiel de FieldParser.java: mesmos rótulos, mesmas regras, mesmas mensagens.
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
const TITULO_MOTIVO = /MOTIVO\s+DO\s+DESLIGAMENTO/iu;
const FIM_MOTIVO = /\n\s*(?:ASSINATURA|OBSERVA[CÇ]ÕES?|DATA\s*:|MUNIC[IÍ]PIO\s*:)/iu;
const CAIXA_MARCADA = /\(\s*[xX]\s*\)/u;
const CAIXA_MARCADA_TODAS = /\(\s*[xX]\s*\)/gu;
const QUALQUER_CAIXA = /\(\s*[xX ]\s*\)/u;
const RUIDO_FINAL_DO_NOME = /[\d()-]+$/u;
const NUMERO_FINAL_DO_MUNICIPIO = /\s+\d+\s*$/u;
const NAO_DIGITOS = /\D/gu;

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

function primeirosDigitos(valor: string, maximo: number): string {
  return valor.replace(NAO_DIGITOS, '').slice(0, maximo);
}

function sanitizarNome(valor: string): string {
  return valor.replace(RUIDO_FINAL_DO_NOME, '').trim();
}

function extrairNome(texto: string): string {
  const achado = ROTULO_NOME.exec(texto);
  if (!achado) return '';
  const valor = sanitizarNome(limpar(achado[1]));
  if (valor) return valor;
  return primeiraLinhaPreenchida(texto.slice(achado.index + achado[0].length), sanitizarNome);
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
    let motivo = limpar(linhas[indice].replace(CAIXA_MARCADA_TODAS, ''));
    if (!motivo) continue;
    if (motivo.slice(0, 5).toLowerCase() === 'outro') {
      for (let seguinte = indice + 1; seguinte < linhas.length; seguinte++) {
        const detalhe = limpar(linhas[seguinte]);
        if (!detalhe || QUALQUER_CAIXA.test(detalhe)) continue;
        motivo = `${motivo}: ${detalhe}`;
        break;
      }
    }
    return motivo;
  }
  return '';
}

export function parseText(texto: string): CamposDesligamento {
  const entrada = texto ?? '';
  return {
    municipio: valorAposRotulo(entrada, 'MUNIC[IÍ]PIO').replace(NUMERO_FINAL_DO_MUNICIPIO, '').trim(),
    cpf: primeirosDigitos(valorAposRotulo(entrada, 'CPF'), 11),
    nis: valorAposRotulo(entrada, 'NIS').replace(NAO_DIGITOS, ''),
    nome: extrairNome(entrada),
    motivo: extrairMotivo(entrada),
  };
}

/** Normaliza o valor digitado numa célula: CPF e NIS aceitam só dígitos (CPF até 11), como o parser os produz. */
export function normalizarCampo(campo: CampoEditavel, valor: string): string {
  if (campo === 'cpf') return primeirosDigitos(valor, 11);
  if (campo === 'nis') return valor.replace(NAO_DIGITOS, '');
  return valor;
}

export function inconsistencies(campos: CamposDesligamento): string[] {
  const problemas = CAMPOS_EDITAVEIS.filter((campo) => !campos[campo]?.trim()).map((campo) => campo.toUpperCase());
  const cpf = campos.cpf?.trim() ?? '';
  if (cpf && cpf.length !== 11) problemas.push('CPF inválido');
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
