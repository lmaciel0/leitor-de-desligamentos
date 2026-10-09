// Worker do pdf.js criado pelo próprio app: carrega os polyfills antes do pdf.js,
// para que navegadores antigos também consigam ler os PDFs.
import '../polyfills';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
