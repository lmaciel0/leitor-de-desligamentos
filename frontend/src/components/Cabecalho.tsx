import { Lock } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { Etapa } from '../lib/etapa';
import { BarraEtapas } from './BarraEtapas';
import { BotaoTema } from './BotaoTema';

interface Props {
  etapa: Etapa;
  processando: boolean;
  escuro: boolean;
  onAlternarTema: () => void;
}

const AVISO_LOCAL = 'Seus PDFs não saem deste computador.';

/**
 * Selo "Local": o balão aparece com o mouse ou o foco e o texto também é a descrição acessível do botão.
 * WCAG 1.4.13: Esc o fecha sem mexer no foco, o ponteiro pode ir até o balão sem ele sumir, e sair e voltar o reabre.
 */
function SeloLocal() {
  const idAviso = useId();
  const [mouse, setMouse] = useState(false);
  const [foco, setFoco] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const aberto = (mouse || foco) && !dispensado;

  /** Só quando nem o mouse nem o foco estão mais no selo é que o Esc deixa de valer e o balão pode reabrir. */
  function atualizar(novoMouse: boolean, novoFoco: boolean) {
    setMouse(novoMouse);
    setFoco(novoFoco);
    if (!novoMouse && !novoFoco) setDispensado(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setDispensado(true);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  return (
    <div className="relative" onMouseEnter={() => atualizar(true, foco)} onMouseLeave={() => atualizar(false, foco)}>
      <button
        type="button"
        aria-describedby={idAviso}
        onFocus={() => atualizar(mouse, true)}
        onBlur={() => atualizar(mouse, false)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-linha bg-superficie px-3 text-xs font-semibold text-suave"
      >
        <Lock size={13} aria-hidden="true" />
        <span className="sr-only md:not-sr-only">Local</span>
      </button>
      {/* O espaço até o botão é padding (não margem), para o ponteiro poder atravessá-lo sem fechar o balão. */}
      <span
        id={idAviso}
        role="tooltip"
        data-aberto={aberto}
        className={`absolute right-0 top-full z-20 w-max max-w-[min(18rem,calc(100vw-2rem))] pt-2 transition-opacity duration-[var(--duracao-curta)] ${
          aberto ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <span className="block rounded-lg border border-linha bg-superficie px-3 py-2 text-xs font-medium text-forte shadow-cartao">{AVISO_LOCAL}</span>
      </span>
    </div>
  );
}

export function Cabecalho({ etapa, processando, escuro, onAlternarTema }: Props) {
  return (
    <header className="border-b border-linha bg-fundo text-forte">
      <div className="largura-pagina grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 md:h-14 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex h-14 min-w-0 items-center gap-2.5 md:h-auto">
          <span
            aria-hidden="true"
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-coral font-titulo text-sm font-extrabold text-sobre-coral"
          >
            L
          </span>
          <h1 className="truncate text-base">Leitor de desligamentos</h1>
        </div>
        <div className="col-start-2 row-start-1 flex items-center gap-2 md:col-start-3 md:justify-self-end">
          <SeloLocal />
          <BotaoTema escuro={escuro} onAlternar={onAlternarTema} />
        </div>
        <div className="col-span-2 row-start-2 pb-3 md:col-span-1 md:col-start-2 md:row-start-1 md:pb-0">
          <BarraEtapas etapa={etapa} processando={processando} />
        </div>
      </div>
    </header>
  );
}
