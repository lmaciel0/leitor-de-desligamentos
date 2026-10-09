import { useEffect, useRef } from 'react';

interface Props {
  linhasEditadas: number;
  /** Pergunta do aviso (o padrão é para reprocessar). */
  titulo?: string;
  rotuloConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function AvisoReprocessar({
  linhasEditadas,
  titulo = 'Processar de novo?',
  rotuloConfirmar = 'Processar de novo',
  onConfirmar,
  onCancelar,
}: Props) {
  const cancelar = useRef<HTMLButtonElement>(null);

  // O foco começa na opção segura.
  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  // Esc cancela enquanto o aviso estiver na tela (padrão de diálogo).
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCancelar();
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onCancelar]);

  const perda =
    linhasEditadas > 0
      ? ` e descarta as suas edições em ${linhasEditadas} ${linhasEditadas === 1 ? 'linha' : 'linhas'}`
      : '';

  return (
    <div
      role="alertdialog"
      aria-labelledby="aviso-reprocessar-titulo"
      aria-describedby="aviso-reprocessar-texto"
      className="mt-4 rounded-md border-2 border-forte bg-superficie p-4"
    >
      <p id="aviso-reprocessar-titulo" className="font-semibold text-forte">
        {titulo}
      </p>
      <p id="aviso-reprocessar-texto" className="mt-1 text-sm">
        {`Isto substitui os resultados atuais${perda}.`}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <button ref={cancelar} type="button" className="botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="botao-primario" onClick={onConfirmar}>
          {rotuloConfirmar}
        </button>
      </div>
    </div>
  );
}
