import { describe, expect, it } from 'vitest';
import { ETAPAS, etapaAtual } from './etapa';

const base = { arquivos: 0, registros: 0, carregando: false, exportado: false };

describe('etapaAtual', () => {
  it.each([
    ['sem PDF e sem registros', { ...base }, 'enviar'],
    ['PDFs escolhidos, sem registros', { ...base, arquivos: 2 }, 'processar'],
    ['processando', { ...base, arquivos: 2, carregando: true }, 'processar'],
    ['reprocessando com registros na tela', { ...base, arquivos: 2, registros: 5, carregando: true }, 'processar'],
    ['registros de um trabalho aberto', { ...base, registros: 5 }, 'revisar'],
    ['PDFs ainda na lista depois de processar', { ...base, arquivos: 2, registros: 5 }, 'revisar'],
    ['registros exportados', { ...base, registros: 5, exportado: true }, 'exportado'],
    ['exportado sem registros (dados limpos)', { ...base, exportado: true }, 'enviar'],
  ] as const)('%s', (_nome, estado, esperada) => {
    expect(etapaAtual(estado)).toBe(esperada);
  });
});

describe('ETAPAS', () => {
  it('lista as quatro etapas na ordem', () => {
    expect(ETAPAS.map((etapa) => etapa.rotulo)).toEqual(['Enviar', 'Processar', 'Revisar', 'Exportar']);
  });
});
