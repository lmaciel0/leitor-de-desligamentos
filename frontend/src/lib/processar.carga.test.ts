import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../testes/criarPdf';

/**
 * Carga do OCR presa (ex.: o tesseract.js nunca termina de criar o worker quando falta o idioma):
 * o OCR real (`lerPorOcr`) com o motor e a rasterização simulados.
 */
const motor = vi.hoisted(() => ({ preparar: vi.fn<() => Promise<void>>(), geracao: 0 }));

vi.mock('./ocr/motorOcr', () => ({
  prepararMotor: motor.preparar,
  reconhecerImagem: vi.fn(async () => ''),
  geracaoDoMotor: vi.fn(() => motor.geracao),
  reiniciarMotor: vi.fn(async () => {}),
}));

vi.mock('./ocr/rasterizar', () => ({
  abrirPdfParaOcr: vi.fn(async () => ({ total: 1, renderizar: vi.fn(), destruir: vi.fn(async () => {}) })),
  miniatura: vi.fn(() => ''),
}));

import { reiniciarMotor } from './ocr/motorOcr';
import { OCR_CARGA_MS, processarLote } from './processar';

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

afterEach(() => {
  vi.useRealTimers();
  motor.preparar.mockReset();
  vi.mocked(reiniciarMotor).mockClear();
});

describe('carga do OCR', () => {
  it('motor que nunca termina de carregar: registro vazio com a mensagem, motor reiniciado e o lote segue', async () => {
    const arquivos = [await pdfFile('escaneado.pdf', [[]]), await pdfFile('ok.pdf', [FORMULARIO])];
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    motor.geracao = 3;
    motor.preparar.mockImplementation(() => {
      // A carga já está contando: só estoura no limite, não antes.
      vi.advanceTimersByTime(OCR_CARGA_MS - 1);
      expect(reiniciarMotor).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      vi.useRealTimers();
      return new Promise<void>(() => {});
    });
    const onEtapa = vi.fn();
    const registros = await processarLote(arquivos, new Date(2026, 10, 11), { onEtapa });
    expect(registros.map((r) => [r.arquivo, r.status, r.inconsistencias])).toEqual([
      ['escaneado.pdf', 'REVISAR', [`PDF não lido: o OCR não carregou em ${OCR_CARGA_MS / 1000} s`]],
      ['ok.pdf', 'OK', []],
    ]);
    expect(registros[0]).toMatchObject({ cpf: '', nome: '' });
    expect(registros[0].lidoPorOcr).toBeUndefined();
    expect(reiniciarMotor).toHaveBeenCalledTimes(1);
    expect(reiniciarMotor).toHaveBeenCalledWith(3);
    expect(onEtapa).toHaveBeenCalledWith('Carregando o OCR…');
  });
});
