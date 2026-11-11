import { describe, expect, it } from 'vitest';
import { avisosDeLeitura } from './avisosDeLeitura';

interface Opcoes {
  responsavel?: string;
  cartao?: string;
  nascimento?: string;
  atualizacao?: string;
  validacao?: string;
  saida?: string;
  marcadores?: string[];
}

function formulario(opcoes: Opcoes = {}): string {
  const {
    responsavel = 'ANA SOUZA',
    cartao = 'ANA SOUZA',
    nascimento = '15/03/1990',
    atualizacao = '10/01/2024',
    validacao = '11/01/2024',
    saida = '12/02/2024',
    marcadores = ['( ) Mudança para outro Estado', '( x ) Mudança para outro Município'],
  } = opcoes;
  return [
    'MUNICÍPIO: CIDADE EXEMPLO',
    'CPF: 056.297.773-27',
    `NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ${responsavel}`,
    `NOME NO CARTÃO CMIC: ${cartao}`,
    `DATA NASC.: ${nascimento}`,
    `DATA DA ÚLTIMA ATUALIZAÇÃO: ${atualizacao}`,
    `DATA DA VALIDAÇÃO CMIC: ${validacao}`,
    'MOTIVO DO DESLIGAMENTO',
    ...marcadores,
    `DATA EM QUE SAIU DO PERFIL DO CMIC: ${saida}`,
    'ASSINATURA',
  ].join('\n');
}

describe('avisosDeLeitura', () => {
  it('não avisa nada num formulário correto', () => {
    expect(avisosDeLeitura(formulario())).toEqual([]);
  });

  it('avisa quando o nome no cartão difere do responsável', () => {
    expect(avisosDeLeitura(formulario({ cartao: 'ANA SOUZA', responsavel: 'ANA SOUSA' }))).toEqual([
      'Nome no cartão CMIC difere do nome do responsável',
    ]);
  });

  it('compara nomes sem acento, sem caixa e sem espaços repetidos', () => {
    expect(avisosDeLeitura(formulario({ cartao: 'josé  da   conceição', responsavel: 'JOSE DA CONCEICAO' }))).toEqual([]);
  });

  it('não avisa de nome quando um dos rótulos não existe', () => {
    const texto = formulario().replace(/NOME NO CARTÃO CMIC:.*\n/u, '');
    expect(avisosDeLeitura(texto)).toEqual([]);
  });

  it.each([
    ['DATA NASC.', { nascimento: '31/02/1990' }],
    ['DATA DA ÚLTIMA ATUALIZAÇÃO', { atualizacao: '32/01/2024' }],
    ['DATA DA VALIDAÇÃO CMIC', { validacao: '11/13/2024' }],
    ['DATA EM QUE SAIU DO PERFIL DO CMIC', { saida: '29/02/2023' }],
  ])('avisa data inválida em %s', (rotulo, opcoes) => {
    expect(avisosDeLeitura(formulario(opcoes))).toEqual([`Data inválida: ${rotulo}`]);
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(avisosDeLeitura(formulario({ saida: '29/02/2024' }))).toEqual([]);
  });

  it('rótulo de data ausente não gera aviso', () => {
    const texto = formulario().replace(/DATA NASC\.:.*\n/u, '');
    expect(avisosDeLeitura(texto)).toEqual([]);
  });

  it('avisa quando nenhum motivo está marcado', () => {
    expect(avisosDeLeitura(formulario({ marcadores: ['( ) Mudança para outro Estado', '( ) Outro'] }))).toEqual([
      'Nenhum motivo de desligamento marcado',
    ]);
  });

  it('avisa quando mais de um motivo está marcado', () => {
    expect(avisosDeLeitura(formulario({ marcadores: ['( x ) Mudança para outro Estado', '( x ) Outro'] }))).toEqual([
      'Mais de um motivo de desligamento marcado',
    ]);
  });
});
