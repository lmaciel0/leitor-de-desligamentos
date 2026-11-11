import { useEffect, useRef, useState } from 'react';

const saida = (t: number) => 1 - (1 - t) ** 3;

function prefereMovimentoReduzido(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

interface Quadro {
  chave: number;
  alvo: number;
  valor: number;
}

/**
 * Número que conta de 0 até `alvo` quando `chave` muda (novo lote, trabalho aberto) e que, se só o
 * `alvo` mudar (edição de um registro), vai direto ao novo valor. Com prefers-reduced-motion
 * devolve sempre `alvo`. Um único requestAnimationFrame em andamento por contador.
 *
 * O estado só guarda o último quadro da animação (com a chave e o alvo a que ele pertence); um
 * quadro de outro alvo é ignorado e o número vai direto ao alvo atual, sem setState em efeito.
 */
export function useContagem(alvo: number, chave: number, duracaoMs = 600): number {
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const alvoAtual = useRef(alvo);
  const reduzido = prefereMovimentoReduzido();

  useEffect(() => {
    alvoAtual.current = alvo;
  }, [alvo]);

  useEffect(() => {
    if (reduzido) return;
    const alvoDaAnimacao = alvoAtual.current;
    let pedido = 0;
    let inicio: number | null = null;
    const passo = (agora: number) => {
      // O alvo mudou no meio do caminho: a animação perdeu o sentido. Grava o quadro final do novo alvo,
      // senão sobraria um quadro do meio que reapareceria se o alvo voltasse ao valor antigo.
      if (alvoAtual.current !== alvoDaAnimacao) {
        setQuadro({ chave, alvo: alvoAtual.current, valor: alvoAtual.current });
        return;
      }
      inicio ??= agora;
      const progresso = Math.min(1, (agora - inicio) / duracaoMs);
      setQuadro({ chave, alvo: alvoDaAnimacao, valor: Math.round(alvoDaAnimacao * saida(progresso)) });
      if (progresso < 1) pedido = requestAnimationFrame(passo);
    };
    pedido = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(pedido);
  }, [chave, duracaoMs, reduzido]);

  if (reduzido) return alvo;
  if (quadro === null || quadro.chave !== chave) return 0;
  return quadro.alvo === alvo ? quadro.valor : alvo;
}
