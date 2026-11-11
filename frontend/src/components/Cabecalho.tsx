import { Lock } from 'lucide-react';
import { useId } from 'react';
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

/** Selo "Local": o balão aparece ao passar o mouse ou ao focar, e o texto também é a descrição acessível do botão. */
function SeloLocal() {
  const idAviso = useId();
  return (
    <div className="group relative">
      <button
        type="button"
        aria-describedby={idAviso}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-linha bg-superficie px-3 text-xs font-semibold text-suave"
      >
        <Lock size={13} aria-hidden="true" />
        <span className="sr-only md:not-sr-only">Local</span>
      </button>
      <span
        id={idAviso}
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-20 mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-linha bg-superficie px-3 py-2 text-xs font-medium text-forte opacity-0 shadow-cartao transition-opacity duration-[var(--duracao-curta)] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {AVISO_LOCAL}
      </span>
    </div>
  );
}

export function Cabecalho({ etapa, processando, escuro, onAlternarTema }: Props) {
  return (
    <header className="border-b border-linha bg-fundo text-forte">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 md:h-14 md:grid-cols-[1fr_auto_1fr] md:px-10">
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
