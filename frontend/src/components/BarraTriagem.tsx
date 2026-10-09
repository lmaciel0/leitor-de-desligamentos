import type { Status } from '../tipos';

interface Props {
  ok: number;
  revisar: number;
  statusAtivo: Status | null;
  onAlternar: (status: Status) => void;
}

const ESTILO: Record<Status, string> = {
  OK: 'bg-denim text-white',
  REVISAR: 'bg-honey text-eclipse',
};

export function BarraTriagem({ ok, revisar, statusAtivo, onAlternar }: Props) {
  const trechos: { status: Status; quantidade: number }[] = [
    { status: 'OK' as const, quantidade: ok },
    { status: 'REVISAR' as const, quantidade: revisar },
  ].filter((trecho) => trecho.quantidade > 0 || trecho.status === statusAtivo);

  return (
    <div role="group" aria-label="Triagem por status" className="flex h-11 overflow-hidden rounded-md">
      {trechos.map(({ status, quantidade }) => {
        const ativo = statusAtivo === status;
        const apagado = statusAtivo !== null && !ativo;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(status)}
            style={{ flexGrow: quantidade }}
            className={`tabular min-w-[7rem] px-4 text-left text-sm font-semibold ${ESTILO[status]} ${
              apagado ? 'opacity-40' : ''
            } ${ativo ? 'ring-2 ring-inset ring-eclipse' : ''}`}
          >
            {quantidade} {status}
          </button>
        );
      })}
    </div>
  );
}
