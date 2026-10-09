import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Comportamento com o worker do pdf.js simulado: no Node o pdf.js roda no mesmo processo,
 * então um worker "travado" só pode ser reproduzido com um dublê.
 */
const estado = vi.hoisted(() => ({ travar: false, atrasoAoCarregar: 0, falharAoCarregar: 0, carregado: false }));

function documentoSimples() {
  const itens = [
    'MUNICÍPIO: CIDADE EXEMPLO',
    'CPF: 529.982.247-25',
    'NIB: 1234567890 NIS:12345678919',
    'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA SOUZA',
    'MOTIVO DO DESLIGAMENTO:',
    '( X ) Mudança para outro Município;',
  ].map((str, i) => ({ str, transform: [1, 0, 0, 1, 40, 800 - i * 20], width: str.length * 5, height: 10 }));
  return { numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: itens }) }) };
}

const nunca = () => new Promise<never>(() => {});

vi.mock('./pdf/carregarPdfjs', () => ({
  carregarPdfjs: vi.fn(async () => {
    if (estado.falharAoCarregar > 0) {
      estado.falharAoCarregar--;
      throw new Error('falha ao baixar o pdf.js');
    }
    // Como o real: só a primeira carga demora; depois o pdf.js fica guardado.
    if (!estado.carregado) await new Promise((resolver) => setTimeout(resolver, estado.atrasoAoCarregar));
    estado.carregado = true;
    return {
      getDocument: () =>
        estado.travar
          ? // Worker preso num laço: nem a leitura nem o destroy() respondem.
            { promise: nunca(), destroy: nunca }
          : { promise: Promise.resolve(documentoSimples()), destroy: async () => {} },
    };
  }),
  reiniciarWorker: vi.fn(async () => {}),
}));

import { reiniciarWorker } from './pdf/carregarPdfjs';
import { processarArquivo, processarLote } from './processar';

const pdf = (nome: string) => new File(['%PDF-1.7'], nome, { type: 'application/pdf' });

afterEach(() => {
  estado.travar = false;
  estado.atrasoAoCarregar = 0;
  estado.falharAoCarregar = 0;
  estado.carregado = false;
  vi.mocked(reiniciarWorker).mockClear();
});

describe('worker do pdf.js', () => {
  it('um PDF que trava o worker não prende o lote: vira REVISAR por tempo e o worker é trocado', async () => {
    estado.travar = true;
    const registro = await processarArquivo(1, pdf('travado.pdf'), '09/10/2026', { tempoMaximoMs: 50 });
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias[0]).toMatch(/^PDF demorou mais de \d+ s para ser lido$/);
    expect(reiniciarWorker).toHaveBeenCalledTimes(1);
  });

  it('o tempo de carregar o pdf.js não conta contra o arquivo', async () => {
    estado.atrasoAoCarregar = 150;
    const registro = await processarArquivo(1, pdf('ok.pdf'), '09/10/2026', { tempoMaximoMs: 50 });
    expect(registro.inconsistencias.join()).not.toContain('demorou');
    expect(registro.status).toBe('OK');
  });

  it('se o pdf.js falhar ao carregar, o arquivo vira REVISAR e o lote segue', async () => {
    estado.falharAoCarregar = 1;
    const registros = await processarLote([pdf('a.pdf'), pdf('b.pdf')], new Date(2026, 9, 9));
    expect(registros[0].inconsistencias).toEqual(['erro de processamento: falha ao baixar o pdf.js']);
    expect(registros[1].status).toBe('OK');
  });
});
