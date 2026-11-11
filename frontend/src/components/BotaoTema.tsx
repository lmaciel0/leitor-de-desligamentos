import { Moon, Sun } from 'lucide-react';

interface Props {
  escuro: boolean;
  onAlternar: () => void;
}

/** Botão só com ícone: o nome acessível fica sempre "Modo escuro" e o estado vai em aria-pressed. */
export function BotaoTema({ escuro, onAlternar }: Props) {
  return (
    <button
      type="button"
      aria-label="Modo escuro"
      aria-pressed={escuro}
      onClick={onAlternar}
      className="grid h-10 w-10 place-items-center rounded-lg border border-linha bg-superficie text-forte transition-colors duration-[var(--duracao-curta)] hover:bg-superficie-alt"
    >
      {escuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
