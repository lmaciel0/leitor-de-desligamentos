import { createWorker, OEM, type Worker as WorkerDoOcr } from 'tesseract.js';

/**
 * Motor de OCR (tesseract.js) servido pela própria origem: o CSP não aceita hosts externos nem `blob:`.
 * Um único worker, criado no primeiro PDF escaneado e reaproveitado pelos arquivos do lote.
 */
const OPCOES_DO_WORKER = {
  workerPath: '/ocr/worker.min.js',
  corePath: '/ocr/core',
  langPath: '/ocr/lang',
  workerBlobURL: false,
};

let motor: Promise<WorkerDoOcr> | null = null;

function criarMotor(): Promise<WorkerDoOcr> {
  // Só a rede LSTM: é o que o modelo `por` (best_int) traz.
  const criando = createWorker('por', OEM.LSTM_ONLY, OPCOES_DO_WORKER);
  motor = criando;
  // Falhou (rede, deploy novo): o próximo prepararMotor tenta de novo.
  criando.catch(() => {
    if (motor === criando) motor = null;
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

/**
 * Descarta o worker (pode estar preso numa página); o próximo prepararMotor cria outro.
 * Não espera: se o modelo ainda está carregando, o worker é encerrado quando ficar pronto.
 */
export async function reiniciarMotor(): Promise<void> {
  const atual = motor;
  motor = null;
  // Falha ao criar já foi tratada em criarMotor: aqui não há o que encerrar.
  void atual?.then((worker) => worker.terminate()).catch(() => {});
}
