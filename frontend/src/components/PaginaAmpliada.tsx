import { Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  imagem: string;
  arquivo: string;
  onFechar: () => void;
}

const FOCAVEIS = 'button, [tabindex="0"]';

/** Página do PDF em tela cheia, só em memória (reusa o data URL). Modal: Esc fecha, o foco fica preso e a página de trás não rola. */
export function PaginaAmpliada({ imagem, arquivo, onFechar }: Props) {
  const [tamanhoReal, setTamanhoReal] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botaoFechar.current?.focus();
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  useEffect(() => {
    function aoPressionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onFechar();
        return;
      }
      if (evento.key !== 'Tab') return;
      // Foco preso: Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último.
      const focaveis = Array.from(dialogo.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      const ativo = document.activeElement;
      if (evento.shiftKey && ativo === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && ativo === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoPressionar);
    return () => document.removeEventListener('keydown', aoPressionar);
  }, [onFechar]);

  return createPortal(
    <div
      ref={dialogo}
      role="dialog"
      aria-modal="true"
      aria-label={`Página do PDF ${arquivo}, em tela cheia`}
      className="fixed inset-0 z-50 flex flex-col bg-fundo/95 backdrop-blur"
    >
      <div className="flex items-center gap-4 border-b border-linha bg-superficie px-4 py-2 md:px-6">
        <p title={arquivo} className="min-w-0 flex-1 truncate text-sm font-semibold text-forte">
          {arquivo}
        </p>
        <button type="button" aria-pressed={tamanhoReal} onClick={() => setTamanhoReal((atual) => !atual)} className="botao-secundario">
          {tamanhoReal ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          {tamanhoReal ? 'Caber na tela' : 'Tamanho real'}
        </button>
        <button ref={botaoFechar} type="button" onClick={onFechar} className="botao-secundario">
          <X size={16} aria-hidden="true" />
          Fechar
        </button>
      </div>
      {/* Em tamanho real a imagem passa da tela: a área precisa de foco para rolar pelo teclado. */}
      <div
        role="region"
        aria-label={`Rolagem da página do PDF ${arquivo}`}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- só em tamanho real: sem foco, o teclado não rola a imagem
        tabIndex={tamanhoReal ? 0 : undefined}
        className="flex min-h-0 flex-1 overflow-auto p-4 md:p-6"
      >
        <img
          src={imagem}
          alt={`Página ampliada do PDF ${arquivo}`}
          className={`m-auto bg-white ${tamanhoReal ? 'max-h-none max-w-none shrink-0' : 'max-h-full max-w-full object-contain'}`}
        />
      </div>
    </div>,
    document.body,
  );
}
