import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Importado só pelo main.tsx: nos testes (Node) o pdf.js usa o worker embutido.
GlobalWorkerOptions.workerSrc = workerUrl;
