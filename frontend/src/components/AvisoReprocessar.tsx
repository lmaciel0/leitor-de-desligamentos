import { useEffect, useRef } from 'react';

interface Props {
  linhasEditadas: number;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function AvisoReprocessar({ linhasEditadas, onConfirmar, onCancelar }: Props) {
  const cancelar = useRef<HTMLButtonElement>(null);

  // O foco começa na opção segura.
  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  const perda =
    linhasEditadas > 0
      ? ` e descarta as suas edições em ${linhasEditadas} ${linhasEditadas === 1 ? 'linha' : 'linhas'}`
      : '';

  return (
    <div
      role="alertdialog"
      aria-labelledby="aviso-reprocessar-titulo"
      aria-describedby="aviso-reprocessar-texto"
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') onCancelar();
      }}
      className="mt-4 rounded-md border-2 border-forte bg-superficie p-4"
    >
      <p id="aviso-reprocessar-titulo" className="font-semibold text-forte">
        Processar de novo?
      </p>
      <p id="aviso-reprocessar-texto" className="mt-1 text-sm">
        {`Isto substitui os resultados atuais${perda}.`}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <button ref={cancelar} type="button" className="botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="botao-primario" onClick={onConfirmar}>
          Processar de novo
        </button>
      </div>
    </div>
  );
}
