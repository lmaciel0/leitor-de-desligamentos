import { describe, expect, it, vi } from 'vitest';
import { LimiteExcedido } from '../pdf/extrairTexto';
import { lerPorOcr, type DependenciasOcr, type OpcoesOcr } from './lerPorOcr';

/** Canvas falso: só carrega o número da página, que as dependências falsas usam. */
function canvasDaPagina(numero: number): HTMLCanvasElement {
  return { pagina: numero, width: 100, height: 100 } as unknown as HTMLCanvasElement;
}

function paginaDo(canvas: HTMLCanvasElement): number {
  return (canvas as unknown as { pagina: number }).pagina;
}

function dependencias(textos: string[], extras: Partial<DependenciasOcr> = {}) {
  const ordem: string[] = [];
  const destruir = vi.fn(async () => {
    ordem.push('destruir');
  });
  const deps = {
    abrirPdf: vi.fn(async () => ({
      total: textos.length,
      renderizar: vi.fn(async (numero: number) => canvasDaPagina(numero)),
      destruir,
    })),
    prepararMotor: vi.fn(async () => {
      ordem.push('prepararMotor');
    }),
    reconhecer: vi.fn(async (canvas: HTMLCanvasElement) => textos[paginaDo(canvas) - 1] ?? ''),
    miniatura: vi.fn((canvas: HTMLCanvasElement) => `miniatura-${paginaDo(canvas)}`),
    ...extras,
  };
  return { deps, destruir, ordem };
}

function opcoes(extras: Partial<OpcoesOcr> = {}): OpcoesOcr {
  return { maxPaginas: 10, sinal: new AbortController().signal, ...extras };
}

const PDF = new ArrayBuffer(8);

describe('lerPorOcr', () => {
  it('une o texto das páginas e avisa o começo e cada página', async () => {
    const { deps, ordem, destruir } = dependencias(['A', 'B']);
    const aoComecar = vi.fn((total: number) => {
      ordem.push(`aoComecar:${total}`);
    });
    const aoIniciarPagina = vi.fn();
    const resultado = await lerPorOcr(PDF, opcoes({ aoComecar, aoIniciarPagina }), deps);
    expect(resultado.texto).toBe('A\nB');
    expect(aoComecar).toHaveBeenCalledTimes(1);
    expect(ordem.indexOf('prepararMotor')).toBeLessThan(ordem.indexOf('aoComecar:2'));
    expect(aoIniciarPagina.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it('a imagem vem da primeira página com o rótulo do responsável', async () => {
    const { deps } = dependencias(['CABEÇALHO', 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA', 'NOME DO RESPONSAVEL']);
    const resultado = await lerPorOcr(PDF, opcoes(), deps);
    expect(resultado.imagem).toBe('miniatura-2');
  });

  it('sem o rótulo em nenhuma página, a imagem vem da página 1', async () => {
    const { deps } = dependencias(['A', 'B']);
    const resultado = await lerPorOcr(PDF, opcoes(), deps);
    expect(resultado.imagem).toBe('miniatura-1');
  });

  it('PDF com mais páginas que o limite é recusado sem reconhecer nada', async () => {
    const { deps, destruir } = dependencias(['A', 'B', 'C']);
    const leitura = lerPorOcr(PDF, opcoes({ maxPaginas: 2 }), deps);
    await expect(leitura).rejects.toBeInstanceOf(LimiteExcedido);
    await expect(leitura).rejects.toThrow('PDF com mais de 2 páginas');
    expect(deps.reconhecer).not.toHaveBeenCalled();
    expect(deps.prepararMotor).not.toHaveBeenCalled();
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it('sinal abortado antes da página 2: rejeita com o motivo do sinal e fecha o PDF', async () => {
    const controlador = new AbortController();
    const motivo = new LimiteExcedido('PDF demorou mais de 1 s para ser lido');
    const { deps, destruir } = dependencias(['A', 'B'], {
      reconhecer: vi.fn(async () => {
        controlador.abort(motivo);
        return 'A';
      }),
    });
    await expect(lerPorOcr(PDF, opcoes({ sinal: controlador.signal }), deps)).rejects.toBe(motivo);
    expect(deps.reconhecer).toHaveBeenCalledTimes(1);
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it('sinal abortado durante o reconhecimento não espera o motor responder', async () => {
    const controlador = new AbortController();
    const motivo = new LimiteExcedido('PDF demorou mais de 1 s para ser lido');
    const { deps, destruir } = dependencias(['A'], {
      reconhecer: vi.fn(() => {
        controlador.abort(motivo);
        return new Promise<string>(() => {});
      }),
    });
    await expect(lerPorOcr(PDF, opcoes({ sinal: controlador.signal }), deps)).rejects.toBe(motivo);
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it('falha ao reconhecer também fecha o PDF', async () => {
    const { deps, destruir } = dependencias(['A'], {
      reconhecer: vi.fn(async () => {
        throw new Error('falha');
      }),
    });
    await expect(lerPorOcr(PDF, opcoes(), deps)).rejects.toThrow('falha');
    expect(destruir).toHaveBeenCalledTimes(1);
  });

  it('normaliza o texto do OCR (rótulo do NIS deformado)', async () => {
    const { deps } = dependencias(['NIB: 0562977732 Ints: 12345678919']);
    const resultado = await lerPorOcr(PDF, opcoes(), deps);
    expect(resultado.texto).toBe('NIB: 0562977732 NIS: 12345678919');
  });
});
