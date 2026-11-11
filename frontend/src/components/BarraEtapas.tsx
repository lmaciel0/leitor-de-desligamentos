import { Check, LoaderCircle } from 'lucide-react';
import { ETAPAS, type Etapa } from '../lib/etapa';

interface Props {
  etapa: Etapa;
  /** Com o lote em andamento, a bolinha da etapa atual gira. */
  processando: boolean;
}

/** Posição da etapa atual; 'exportado' fica depois da última, então todas contam como concluídas. */
function indiceDe(etapa: Etapa): number {
  return etapa === 'exportado' ? ETAPAS.length : ETAPAS.findIndex((item) => item.id === etapa);
}

const BOLA = {
  feita: 'border-forte/50 bg-destaque text-sobre-destaque',
  atual: 'border-coral bg-coral text-sobre-coral ring-4 ring-coral/25',
  proxima: 'border-apagado bg-fundo',
} as const;

const ROTULO = { feita: 'text-forte', atual: 'text-coral-texto', proxima: 'text-suave' } as const;

/** A linha liga o centro da bolinha anterior ao da própria bolinha: navy até a etapa atual, apagada depois. */
const LIGACAO = {
  feita: 'before:bg-forte/70',
  atual: 'before:bg-forte/70',
  proxima: 'before:bg-apagado/40',
} as const;

/** Só indica o ponto do fluxo: não é clicável. No celular a linha some e fica o texto "Etapa 3 de 4 · Revisar". */
export function BarraEtapas({ etapa, processando }: Props) {
  const atual = indiceDe(etapa);
  const resumo = etapa === 'exportado' ? 'Etapa 4 de 4 · Exportado' : `Etapa ${atual + 1} de ${ETAPAS.length} · ${ETAPAS[atual]?.rotulo}`;

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-forte md:hidden">{resumo}</p>
      <nav aria-label="Etapas" className="hidden md:block">
        <ol className="m-0 flex w-[340px] list-none p-0 text-xs font-semibold">
          {ETAPAS.map((item, indice) => {
            const estado = indice < atual ? 'feita' : indice === atual ? 'atual' : 'proxima';
            return (
              <li
                key={item.id}
                aria-current={estado === 'atual' ? 'step' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-1 ${ROTULO[estado]} ${
                  indice > 0 ? `before:absolute before:-left-1/2 before:top-2 before:h-0.5 before:w-full before:content-[''] ${LIGACAO[estado]}` : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative z-10 grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${BOLA[estado]}`}
                >
                  {estado === 'feita' && <Check size={10} strokeWidth={3.5} />}
                  {estado === 'atual' && processando && <LoaderCircle size={10} strokeWidth={3} className="animate-spin" />}
                </span>
                {item.rotulo}
                {estado === 'feita' && <span className="sr-only">concluída</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
