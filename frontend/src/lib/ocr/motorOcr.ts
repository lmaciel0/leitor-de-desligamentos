import { createWorker, OEM, type Worker as WorkerDoOcr } from 'tesseract.js';

/**
 * Motor de OCR (tesseract.js) servido pela própria origem: o CSP não aceita hosts externos nem `blob:`.
 * Um único worker, criado no primeiro PDF escaneado e reaproveitado pelos arquivos do lote.
 * `cacheMethod: 'none'`: o modelo não é guardado no navegador (IndexedDB); nada fica salvo.
 */
const OPCOES_DO_WORKER = {
  workerPath: '/ocr/worker.min.js',
  corePath: '/ocr/core',
  langPath: '/ocr/lang',
  workerBlobURL: false,
  cacheMethod: 'none',
};

let motor: Promise<WorkerDoOcr> | null = null;
/** Muda a cada reinício: quem pede um reinício diz de qual geração é o motor que usou. */
let geracao = 0;

function criarMotor(): Promise<WorkerDoOcr> {
  let falharAoCarregar: (erro: Error) => void = () => {};
  const falhaAoCarregar = new Promise<never>((_, rejeitar) => {
    falharAoCarregar = rejeitar;
  });
  // Só a rede LSTM: é o que o modelo `por` (best_int) traz.
  const trabalhador = createWorker('por', OEM.LSTM_ONLY, {
    ...OPCOES_DO_WORKER,
    // O tesseract.js 5 engole a falha ao carregar o idioma ou iniciar (ex.: `por.traineddata.gz`
    // ausente) e a criação nunca termina: o errorHandler é o único aviso, e faz a criação falhar.
    // Depois de criado, uma falha também chega aqui, mas a criação já terminou e nada muda.
    errorHandler: (erro: unknown) => falharAoCarregar(new Error(`o OCR não carregou: ${String(erro)}`)),
  });
  const criando = Promise.race([trabalhador, falhaAoCarregar]);
  motor = criando;
  criando.catch(() => {
    // Falhou (rede, deploy novo): o próximo prepararMotor tenta de novo.
    if (motor === criando) motor = null;
    // Se o worker ainda assim ficar pronto, ninguém vai usá-lo.
    void trabalhador.then((worker) => worker.terminate()).catch(() => {});
  });
  return criando;
}

/** Cria o worker e carrega o modelo, só na primeira vez. */
export async function prepararMotor(): Promise<void> {
  await (motor ?? criarMotor());
}

export async function reconhecerImagem(imagem: HTMLCanvasElement): Promise<string> {
  const worker = await (motor ?? criarMotor());
  const { data } = await worker.recognize(imagem);
  return data.text;
}

/** Geração do motor em uso agora: guarde no começo da leitura e passe a `reiniciarMotor`. */
export function geracaoDoMotor(): number {
  return geracao;
}

/**
 * Descarta o worker da geração pedida (pode estar preso numa página); o próximo prepararMotor cria outro.
 * Se essa geração já foi aposentada (por outro pedido, de outro arquivo ou lote), não faz nada:
 * o motor atual pode estar lendo o PDF de outro lote.
 * Não espera: se o modelo ainda está carregando, o worker é encerrado quando ficar pronto.
 */
export async function reiniciarMotor(geracaoAposentada: number): Promise<void> {
  if (geracaoAposentada !== geracao) return;
  geracao += 1;
  const atual = motor;
  motor = null;
  // Falha ao criar já foi tratada em criarMotor: aqui não há o que encerrar.
  void atual?.then((worker) => worker.terminate()).catch(() => {});
}
