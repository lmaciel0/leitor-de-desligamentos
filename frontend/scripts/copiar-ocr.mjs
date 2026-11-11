// Copia os arquivos do OCR de node_modules para public/ocr/ (ignorado pelo git), para o app
// servi-los pela própria origem (CSP sem hosts externos). Roda em predev, prebuild e prepreview.
//
// Destinos (os mesmos que o app passa a createWorker):
//   /ocr/worker.min.js                workerPath
//   /ocr/core/                        corePath (diretório; o worker escolhe a variante)
//   /ocr/lang/por.traineddata.gz      langPath (diretório)
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulos = join(raiz, 'node_modules');
const destino = join(raiz, 'public', 'ocr');

// O worker carrega só os *.wasm.js (WASM embutido); .wasm e .js soltos não são usados.
const nucleos = [
  'tesseract-core.wasm.js',
  'tesseract-core-simd.wasm.js',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
];

const copias = [
  [join(modulos, 'tesseract.js', 'dist', 'worker.min.js'), join(destino, 'worker.min.js')],
  ...nucleos.map((nome) => [join(modulos, 'tesseract.js-core', nome), join(destino, 'core', nome)]),
  [
    join(modulos, '@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz'),
    join(destino, 'lang', 'por.traineddata.gz'),
  ],
];

const ausentes = copias.map(([origem]) => origem).filter((origem) => !existsSync(origem));
if (ausentes.length > 0) {
  console.error('copiar-ocr: arquivos de origem não encontrados (rode "npm ci"):');
  for (const origem of ausentes) console.error(`  - ${origem}`);
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
for (const [origem, saida] of copias) {
  mkdirSync(dirname(saida), { recursive: true });
  copyFileSync(origem, saida);
}
console.log(`copiar-ocr: ${copias.length} arquivos copiados para public/ocr`);
