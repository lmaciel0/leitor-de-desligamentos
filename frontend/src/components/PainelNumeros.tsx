import { useContagem } from '../lib/contagem';
import type { Status } from '../tipos';

interface Props {
  total: number;
  ok: number;
  revisar: number;
  conferidos: number;
  totalRevisao: number;
  statusAtivo: Status | null;
  onAlternar: (status: Status) => void;
  /** Número do lote: quando muda, os números contam de novo desde 0. */
  lote: number;
}

const CARTAO = 'rounded-cartao border p-3.5 sm:p-4';
const NUMERO = 'tabular block font-titulo text-[28px] font-extrabold leading-none';
const ROTULO = 'mt-1.5 block text-xs font-semibold';

function Numero({ valor, lote, className }: { valor: number; lote: number; className: string }) {
  const exibido = useContagem(valor, lote);
  return <span className={`${NUMERO} ${className}`}>{exibido}</span>;
}

interface CartaoStatusProps {
  status: Status;
  quantidade: number;
  lote: number;
  statusAtivo: Status | null;
  onAlternar: (status: Status) => void;
}

function CartaoStatus({ status, quantidade, lote, statusAtivo, onAlternar }: CartaoStatusProps) {
  const ativo = statusAtivo === status;
  const apagado = statusAtivo !== null && !ativo;
  const revisar = status === 'REVISAR';
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={`${quantidade} ${status}`}
      onClick={() => onAlternar(status)}
      className={`${CARTAO} cursor-pointer text-left transition-[opacity,box-shadow] duration-150 hover:shadow-cartao md:flex-1 ${
        revisar ? 'border-coral/40 bg-coral-fundo' : 'border-linha bg-superficie'
      } ${apagado ? 'opacity-60' : ''} ${ativo ? 'ring-2 ring-anel' : ''}`}
    >
      <span aria-hidden="true">
        <Numero valor={quantidade} lote={lote} className={revisar ? 'text-coral-texto' : 'text-forte'} />
        <span className={`${ROTULO} ${revisar ? 'text-coral-texto' : 'text-suave'}`}>{status}</span>
      </span>
    </button>
  );
}

export function PainelNumeros({ total, ok, revisar, conferidos, totalRevisao, statusAtivo, onAlternar, lote }: Props) {
  const cartoes = [
    { status: 'OK' as const, quantidade: ok },
    { status: 'REVISAR' as const, quantidade: revisar },
  ].filter((cartao) => cartao.quantidade > 0 || cartao.status === statusAtivo);
  const porcento = totalRevisao > 0 ? Math.min(100, (conferidos / totalRevisao) * 100) : 0;

  return (
    <div role="group" aria-label="Triagem por status" className="grid grid-cols-2 gap-2.5 md:flex">
      <div className={`${CARTAO} border-linha bg-superficie md:flex-1`}>
        <Numero valor={total} lote={lote} className="text-forte" />
        <span className={`${ROTULO} text-suave`}>arquivos lidos</span>
      </div>
      {cartoes.map(({ status, quantidade }) => (
        <CartaoStatus
          key={status}
          status={status}
          quantidade={quantidade}
          lote={lote}
          statusAtivo={statusAtivo}
          onAlternar={onAlternar}
        />
      ))}
      {totalRevisao > 0 && (
        <div className={`${CARTAO} col-span-2 border-destaque bg-destaque text-sobre-destaque dark:border-linha md:flex-[1.4]`}>
          <span className="block text-xs font-semibold text-sobre-destaque/80">Revisão</span>
          <span className="tabular mt-1 block font-bold">
            {conferidos} de {totalRevisao} conferidos
          </span>
          <div
            role="progressbar"
            aria-label="Revisão"
            aria-valuemin={0}
            aria-valuemax={totalRevisao}
            aria-valuenow={conferidos}
            aria-valuetext={`${conferidos} de ${totalRevisao} conferidos`}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sobre-destaque/20"
          >
            <div
              className="h-full origin-left rounded-full bg-coral transition-transform duration-[var(--duracao-media)] ease-[var(--curva)]"
              style={{ width: '100%', transform: `scaleX(${porcento / 100})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
