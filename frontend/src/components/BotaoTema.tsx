import { Moon, Sun } from 'lucide-react';

interface Props {
  escuro: boolean;
  onAlternar: () => void;
}

/** Botão de alternância: o nome fica sempre "Modo escuro" e o estado vai em aria-pressed. */
export function BotaoTema({ escuro, onAlternar }: Props) {
  return (
    <button
      type="button"
      aria-pressed={escuro}
      onClick={onAlternar}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-forte/50 px-4 text-sm font-semibold text-forte hover:bg-superficie"
    >
      {escuro ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      Modo escuro
    </button>
  );
}
