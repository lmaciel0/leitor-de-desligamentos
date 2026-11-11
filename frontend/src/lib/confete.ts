import type { CreateTypes } from 'canvas-confetti';

const CORES = ['#FF6B5B', '#14213D', '#F4EDE0', '#FFB3A9'];

/** Uma única instância: o canvas e a biblioteca só são criados no primeiro disparo. */
let instancia: Promise<CreateTypes> | null = null;

function prefereMovimentoReduzido(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function criarCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000;';
  document.body.appendChild(canvas);
  return canvas;
}

function obterInstancia(): Promise<CreateTypes> {
  // Import dinâmico: a biblioteca não pesa o carregamento inicial.
  instancia ??= import('canvas-confetti').then(({ default: confetti }) =>
    // useWorker false: um worker via blob: seria barrado pela CSP (worker-src 'self').
    confetti.create(criarCanvas(), { resize: true, useWorker: false, disableForReducedMotion: true }),
  );
  return instancia;
}

/** Confete curto de fim de revisão. Sem efeito com prefers-reduced-motion (a regra global de CSS não alcança canvas). */
export function soltarConfete(): void {
  if (prefereMovimentoReduzido()) return;
  obterInstancia()
    .then((confetti) => confetti({ particleCount: 120, spread: 70, origin: { y: 0.3 }, colors: CORES }))
    .catch(() => {
      // Efeito decorativo: se a biblioteca não carregar, a revisão segue normalmente.
      instancia = null;
    });
}
