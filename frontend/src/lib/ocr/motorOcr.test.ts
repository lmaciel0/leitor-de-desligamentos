import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Worker do tesseract.js simulado: cada `createWorker` fica pendente até o teste decidir. */
interface Criacao {
  opcoes: Record<string, unknown>;
  worker: { terminate: ReturnType<typeof vi.fn>; recognize: ReturnType<typeof vi.fn> };
  pronto: () => void;
}

const tesseract = vi.hoisted(() => ({ criacoes: [] as Criacao[] }));

vi.mock('tesseract.js', () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker: vi.fn(
    (_idioma: string, _oem: number, opcoes: Record<string, unknown>) =>
      new Promise((resolver) => {
        const worker = { terminate: vi.fn(async () => {}), recognize: vi.fn(async () => ({ data: { text: 'texto' } })) };
        tesseract.criacoes.push({ opcoes, worker, pronto: () => resolver(worker) });
      }),
  ),
}));

type MotorOcr = typeof import('./motorOcr');

async function motorNovo(): Promise<MotorOcr> {
  vi.resetModules();
  return import('./motorOcr');
}

/** Deixa as promessas pendentes andarem (o createWorker é chamado dentro de uma). */
const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => {
  tesseract.criacoes = [];
});

describe('motorOcr', () => {
  it('cria o worker com os arquivos da própria origem e sem cache no navegador', async () => {
    const { prepararMotor } = await motorNovo();
    const preparando = prepararMotor();
    await esperar();
    expect(tesseract.criacoes).toHaveLength(1);
    expect(tesseract.criacoes[0].opcoes).toMatchObject({
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      cacheMethod: 'none',
    });
    tesseract.criacoes[0].pronto();
    await expect(preparando).resolves.toBeUndefined();
  });

  it('falha ao carregar o idioma (o tesseract.js só avisa pelo errorHandler) faz a preparação falhar e a próxima tenta de novo', async () => {
    const { prepararMotor } = await motorNovo();
    const preparando = prepararMotor();
    await esperar();
    const { errorHandler } = tesseract.criacoes[0].opcoes as { errorHandler: (erro: unknown) => void };
    errorHandler('Network error while fetching /ocr/lang/por.traineddata.gz. Response code: 404');
    await expect(preparando).rejects.toThrow('por.traineddata.gz');
    const outra = prepararMotor();
    await esperar();
    expect(tesseract.criacoes).toHaveLength(2);
    tesseract.criacoes[1].pronto();
    await expect(outra).resolves.toBeUndefined();
  });

  it('reiniciar encerra só o motor da geração pedida, não o que outro pedido já criou no lugar', async () => {
    const { prepararMotor, reiniciarMotor, geracaoDoMotor } = await motorNovo();
    const preparando = prepararMotor();
    await esperar();
    tesseract.criacoes[0].pronto();
    await preparando;
    const geracaoDoArquivo = geracaoDoMotor();

    await reiniciarMotor(geracaoDoArquivo);
    await esperar();
    expect(tesseract.criacoes[0].worker.terminate).toHaveBeenCalledTimes(1);

    const novo = prepararMotor();
    await esperar();
    tesseract.criacoes[1].pronto();
    await novo;
    // Pedido atrasado, da geração já aposentada: o motor novo fica.
    await reiniciarMotor(geracaoDoArquivo);
    await esperar();
    expect(tesseract.criacoes[1].worker.terminate).not.toHaveBeenCalled();
    expect(tesseract.criacoes).toHaveLength(2);
  });

  it('reiniciar com o modelo ainda carregando encerra o worker quando ele ficar pronto', async () => {
    const { prepararMotor, reiniciarMotor, geracaoDoMotor } = await motorNovo();
    void prepararMotor().catch(() => {});
    await esperar();
    await reiniciarMotor(geracaoDoMotor());
    tesseract.criacoes[0].pronto();
    await esperar();
    expect(tesseract.criacoes[0].worker.terminate).toHaveBeenCalledTimes(1);
  });
});
