import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../testes/criarPdf';

vi.mock('./ocr/lerPorOcr', () => ({ lerPorOcr: vi.fn(), geracaoDoOcr: vi.fn(() => 0), reiniciarOcr: vi.fn(async () => {}) }));

import { PENDENCIA_OCR } from './parser/campos';
import { LimiteExcedido } from './pdf/extrairTexto';
import { limparImagens, obterImagem } from './ocr/imagens';
import { lerPorOcr, reiniciarOcr } from './ocr/lerPorOcr';
import {
  formatarReferencia,
  MENSAGEM_OCR_VAZIO,
  orcamentoOcrMs,
  processarArquivo,
  processarLote,
} from './processar';

const FORMULARIO: TextoNaPagina[] = [
  { texto: 'MUNICÍPIO: CIDADE EXEMPLO', x: 50, y: 800 },
  { texto: 'CPF: 001.234.567-97', x: 50, y: 780 },
  { texto: 'NIB: 0012345678', x: 50, y: 770 },
  { texto: 'NIS: 12345678919', x: 50, y: 760 },
  { texto: 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA', x: 50, y: 740 },
  { texto: 'MOTIVO DO DESLIGAMENTO', x: 50, y: 700 },
  { texto: '(X) Mudança para outro Estado', x: 50, y: 680 },
];

async function pdfFile(nome: string, paginas: TextoNaPagina[][]): Promise<File> {
  return new File([await criarPdf(paginas)], nome, { type: 'application/pdf' });
}

describe('formatarReferencia', () => {
  it('formata dd/MM/yyyy com zeros à esquerda', () => {
    expect(formatarReferencia(new Date(2026, 8, 7))).toBe('07/09/2026');
    expect(formatarReferencia(new Date(2026, 11, 25))).toBe('25/12/2026');
  });
});

describe('processarArquivo', () => {
  it('extrai os campos e marca OK quando está completo', async () => {
    const registro = await processarArquivo(3, await pdfFile('ok.pdf', [FORMULARIO]), '09/10/2026');
    expect(registro).toEqual({
      id: 3,
      arquivo: 'ok.pdf',
      referencia: '09/10/2026',
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456797',
      nis: '12345678919',
      nib: '0012345678',
      nome: 'MARIA DA SILVA',
      motivo: 'Mudança para outro Estado',
      municipioConfere: false,
      validado: false,
      recebeCmic: false,
      status: 'OK',
      inconsistencias: [],
    });
  });

  it('registros com erro também começam sem marcações de conferência', async () => {
    const vazio = new File([new Uint8Array(0)], 'vazio.pdf', { type: 'application/pdf' });
    const registro = await processarArquivo(1, vazio, '09/10/2026');
    expect([registro.municipioConfere, registro.validado, registro.recebeCmic]).toEqual([false, false, false]);
  });

  it('marca REVISAR e lista os campos que faltam', async () => {
    const semCpf = FORMULARIO.filter((linha) => !linha.texto.startsWith('CPF'));
    const registro = await processarArquivo(1, await pdfFile('sem-cpf.pdf', [semCpf]), '09/10/2026');
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias).toEqual(['CPF']);
  });

  it('converte falha do pdf.js em "erro de processamento" (arquivo de 0 bytes)', async () => {
    const vazio = new File([new Uint8Array(0)], 'vazio.pdf', { type: 'application/pdf' });
    const registro = await processarArquivo(1, vazio, '09/10/2026');
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias).toHaveLength(1);
    expect(registro.inconsistencias[0]).toMatch(/^erro de processamento: /);
  });

  it('usa "arquivo.pdf" quando o nome vem vazio', async () => {
    const registro = await processarArquivo(1, await pdfFile('', [FORMULARIO]), '09/10/2026');
    expect(registro.arquivo).toBe('arquivo.pdf');
  });
});

describe('processarLote', () => {
  it('um arquivo ruim no meio não derruba o lote e os ids seguem a ordem', async () => {
    const arquivos = [
      await pdfFile('a.pdf', [FORMULARIO]),
      new File(['isto não é um pdf'], 'texto.pdf', { type: 'application/pdf' }),
      await pdfFile('c.pdf', [FORMULARIO]),
    ];
    const registros = await processarLote(arquivos, new Date(2026, 9, 9));
    expect(registros.map((r) => [r.id, r.arquivo, r.status])).toEqual([
      [1, 'a.pdf', 'OK'],
      [2, 'texto.pdf', 'REVISAR'],
      [3, 'c.pdf', 'OK'],
    ]);
    expect(registros.every((r) => r.referencia === '09/10/2026')).toBe(true);
  });

  it('reporta o progresso a cada arquivo', async () => {
    const onProgresso = vi.fn();
    const arquivos = [await pdfFile('a.pdf', [FORMULARIO]), await pdfFile('b.pdf', [FORMULARIO])];
    await processarLote(arquivos, new Date(), { onProgresso });
    expect(onProgresso.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it('para quando o sinal é abortado', async () => {
    const controlador = new AbortController();
    const arquivos = [await pdfFile('a.pdf', [FORMULARIO]), await pdfFile('b.pdf', [FORMULARIO])];
    const registros = await processarLote(arquivos, new Date(), {
      signal: controlador.signal,
      onProgresso: () => controlador.abort(),
    });
    expect(registros).toHaveLength(1);
  });

  it('devolve lista vazia para lote vazio', async () => {
    expect(await processarLote([], new Date())).toEqual([]);
  });
});

describe('processarArquivo com limites', () => {
  it('PDF maior que 20 MB vira REVISAR sem ser lido', async () => {
    const grande = new File([new Uint8Array(21 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' });
    const registro = await processarArquivo(1, grande, '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', inconsistencias: ['PDF maior que 20 MB'] });
  });

  it('PDF com mais de 10 páginas vira REVISAR', async () => {
    const onzePaginas = Array.from({ length: 11 }, () => FORMULARIO);
    const registro = await processarArquivo(1, await pdfFile('longo.pdf', onzePaginas), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', cpf: '', inconsistencias: ['PDF com mais de 10 páginas'] });
  });

  it('PDF que passa do tempo limite vira REVISAR com o motivo', async () => {
    const registro = await processarArquivo(1, await pdfFile('lento.pdf', [FORMULARIO]), '09/10/2026', { tempoMaximoMs: 0 });
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias).toEqual(['PDF demorou mais de 0 s para ser lido']);
  });

  it('um PDF que estoura o limite não impede o próximo do lote', async () => {
    const arquivos = [
      new File([new Uint8Array(21 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' }),
      await pdfFile('ok.pdf', [FORMULARIO]),
    ];
    const registros = await processarLote(arquivos, new Date(2026, 9, 9));
    expect(registros.map((r) => [r.arquivo, r.status, r.inconsistencias])).toEqual([
      ['grande.pdf', 'REVISAR', ['PDF maior que 20 MB']],
      ['ok.pdf', 'OK', []],
    ]);
  });
});

describe('processarArquivo com PDF escaneado (OCR)', () => {
  const TEXTO_DO_FORMULARIO = FORMULARIO.map((linha) => linha.texto).join('\n');
  const escaneado = () => pdfFile('imagem.pdf', [[]]);

  afterEach(() => {
    vi.mocked(lerPorOcr).mockReset();
    vi.mocked(reiniciarOcr).mockClear();
    vi.useRealTimers();
    limparImagens();
  });

  it('lê o formulário por OCR: campos preenchidos, REVISAR com a pendência de OCR e a imagem guardada', async () => {
    vi.mocked(lerPorOcr).mockResolvedValue({ texto: TEXTO_DO_FORMULARIO, imagem: 'data:image/jpeg;base64,AAA' });
    const registro = await processarArquivo(7, await escaneado(), '09/10/2026');
    expect(registro).toMatchObject({
      id: 7,
      arquivo: 'imagem.pdf',
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456797',
      nis: '12345678919',
      nib: '0012345678',
      nome: 'MARIA DA SILVA',
      motivo: 'Mudança para outro Estado',
      validado: false,
      lidoPorOcr: true,
      status: 'REVISAR',
    });
    expect(registro.inconsistencias[0]).toBe(PENDENCIA_OCR);
    expect(obterImagem(7)).toBe('data:image/jpeg;base64,AAA');
  });

  it('OCR sem texto vira registro vazio com a mensagem própria, sem a marca de OCR', async () => {
    vi.mocked(lerPorOcr).mockResolvedValue({ texto: ' \n ', imagem: 'data:image/jpeg;base64,AAA' });
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', cpf: '', inconsistencias: [MENSAGEM_OCR_VAZIO] });
    expect(registro.lidoPorOcr).toBeUndefined();
    expect(obterImagem(1)).toBeUndefined();
  });

  it('PDF em branco no meio do lote não impede os seguintes', async () => {
    vi.mocked(lerPorOcr).mockResolvedValue({ texto: '', imagem: null });
    const registros = await processarLote([await escaneado(), await pdfFile('ok.pdf', [FORMULARIO])], new Date(2026, 9, 9));
    expect(registros.map((r) => [r.arquivo, r.status, r.inconsistencias])).toEqual([
      ['imagem.pdf', 'REVISAR', [MENSAGEM_OCR_VAZIO]],
      ['ok.pdf', 'OK', []],
    ]);
  });

  it('PDF com texto não passa pelo OCR', async () => {
    const registro = await processarArquivo(1, await pdfFile('ok.pdf', [FORMULARIO]), '09/10/2026');
    expect(registro.status).toBe('OK');
    expect(lerPorOcr).not.toHaveBeenCalled();
  });

  it('limite excedido no OCR com o motor pronto vira registro vazio e reinicia o motor', async () => {
    vi.mocked(lerPorOcr).mockImplementation(async (_pdf, opcoes) => {
      opcoes.aoComecar?.(1);
      throw new LimiteExcedido('página inválida');
    });
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', inconsistencias: ['página inválida'] });
    expect(reiniciarOcr).toHaveBeenCalledTimes(1);
  });

  it('PDF escaneado com páginas demais vira registro vazio sem descartar o motor', async () => {
    vi.mocked(lerPorOcr).mockRejectedValue(new LimiteExcedido('PDF com mais de 10 páginas'));
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', inconsistencias: ['PDF com mais de 10 páginas'] });
    expect(reiniciarOcr).not.toHaveBeenCalled();
  });

  it('escaneado com páginas demais não atrapalha o escaneado seguinte', async () => {
    vi.mocked(lerPorOcr)
      .mockRejectedValueOnce(new LimiteExcedido('PDF com mais de 10 páginas'))
      .mockResolvedValueOnce({ texto: TEXTO_DO_FORMULARIO, imagem: null });
    const registros = await processarLote([await escaneado(), await escaneado()], new Date(2026, 9, 9));
    expect(registros[0].inconsistencias).toEqual(['PDF com mais de 10 páginas']);
    expect(registros[1].lidoPorOcr).toBe(true);
    expect(reiniciarOcr).not.toHaveBeenCalled();
  });

  it('outra falha do OCR vira "erro de processamento"', async () => {
    vi.mocked(lerPorOcr).mockRejectedValue(new Error('falha'));
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026');
    expect(registro.inconsistencias).toEqual(['erro de processamento: falha']);
  });

  it('o relógio do OCR começa em aoComecar, com o orçamento pelas páginas, e estourar reinicia o motor', async () => {
    vi.mocked(lerPorOcr).mockImplementation(async (_pdf, opcoes) => {
      vi.useFakeTimers();
      opcoes.aoComecar?.(1);
      const interrompida = new Promise<never>((_, rejeitar) =>
        opcoes.sinal.addEventListener('abort', () => rejeitar(opcoes.sinal.reason), { once: true }),
      );
      vi.advanceTimersByTime(orcamentoOcrMs(1) - 1);
      expect(opcoes.sinal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      vi.useRealTimers();
      return interrompida;
    });
    const registros = await processarLote([await escaneado(), await pdfFile('ok.pdf', [FORMULARIO])], new Date(2026, 9, 9));
    expect(registros[0].inconsistencias).toEqual(['PDF demorou mais de 32 s para ser lido']);
    expect(reiniciarOcr).toHaveBeenCalledTimes(1);
    expect(registros[1].status).toBe('OK');
  });

  it('cancelar o lote durante o OCR termina o arquivo sem travar e reinicia o motor', async () => {
    const controlador = new AbortController();
    vi.mocked(lerPorOcr).mockImplementation(() => {
      controlador.abort();
      return new Promise(() => {});
    });
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026', {}, { sinalDoLote: controlador.signal });
    expect(registro.status).toBe('REVISAR');
    expect(reiniciarOcr).toHaveBeenCalledTimes(1);
  });

  it('lote já cancelado antes de o OCR começar: não lê nem reinicia nada (o motor pode ser do lote seguinte)', async () => {
    const controlador = new AbortController();
    controlador.abort();
    const registro = await processarArquivo(1, await escaneado(), '09/10/2026', {}, { sinalDoLote: controlador.signal });
    expect(registro).toMatchObject({ status: 'REVISAR', inconsistencias: ['PDF não lido: o lote foi cancelado'] });
    expect(lerPorOcr).not.toHaveBeenCalled();
    expect(reiniciarOcr).not.toHaveBeenCalled();
  });

  it('avisa cada página lida por OCR, também pelo lote', async () => {
    vi.mocked(lerPorOcr).mockImplementation(async (_pdf, opcoes) => {
      opcoes.aoComecar?.(2);
      opcoes.aoIniciarPagina?.(1, 2);
      opcoes.aoIniciarPagina?.(2, 2);
      return { texto: '', imagem: null };
    });
    const onEtapa = vi.fn();
    await processarLote([await escaneado()], new Date(), { onEtapa });
    expect(onEtapa.mock.calls).toEqual([
      ['Carregando o OCR…'],
      ['Lendo imagem.pdf por OCR (página 1 de 2)'],
      ['Lendo imagem.pdf por OCR (página 2 de 2)'],
    ]);
  });

  it('orçamento do OCR: 20 s mais 12 s por página', () => {
    expect(orcamentoOcrMs(10)).toBe(140_000);
  });
});
