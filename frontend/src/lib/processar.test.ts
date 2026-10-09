import { describe, expect, it, vi } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../testes/criarPdf';
import { formatarReferencia, MENSAGEM_PDF_ESCANEADO, processarArquivo, processarLote } from './processar';

const FORMULARIO: TextoNaPagina[] = [
  { texto: 'MUNICÍPIO: CIDADE EXEMPLO', x: 50, y: 800 },
  { texto: 'CPF: 001.234.567-89', x: 50, y: 780 },
  { texto: 'NIB: 0012345678', x: 50, y: 770 },
  { texto: 'NIS: 000123456789', x: 50, y: 760 },
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
      cpf: '00123456789',
      nis: '000123456789',
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

  it('sinaliza PDF sem texto como escaneado', async () => {
    const registro = await processarArquivo(1, await pdfFile('imagem.pdf', [[]]), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', cpf: '', inconsistencias: [MENSAGEM_PDF_ESCANEADO] });
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
