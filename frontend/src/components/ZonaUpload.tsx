import { FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  arquivos: File[];
  /** Recebe tudo o que foi escolhido ou solto; quem usa decide o que é PDF e avisa o que ignorou. */
  onAdicionar: (arquivos: File[]) => void;
  onRemover: (indice: number) => void;
}

export function ZonaUpload({ arquivos, onAdicionar, onRemover }: Props) {
  const [arrastando, setArrastando] = useState(false);

  return (
    <div>
      <label
        data-testid="zona-upload"
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastando(false);
          onAdicionar(Array.from(evento.dataTransfer.files));
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] border-dashed px-[18px] py-4 text-forte transition-colors [transition-duration:var(--duracao-curta)] focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-anel ${
          arrastando ? 'border-coral bg-coral-fundo' : 'border-apagado bg-superficie/60'
        }`}
      >
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-coral-claro text-coral-texto">
          <Upload size={18} aria-hidden="true" />
        </span>
        <span className="font-semibold">Solte os PDFs aqui ou escolha arquivos</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          aria-label="Solte os PDFs aqui ou escolha arquivos"
          onChange={(evento) => {
            onAdicionar(Array.from(evento.target.files ?? []));
            evento.target.value = '';
          }}
        />
      </label>
      {arquivos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Arquivos escolhidos">
          {arquivos.map((arquivo, indice) => (
            <li
              key={`${arquivo.name}-${indice}`}
              className="flex max-w-full items-center gap-2 rounded-full bg-fundo px-3 py-1.5 text-sm text-forte"
            >
              <FileText size={14} aria-hidden="true" />
              <span className="truncate">{arquivo.name}</span>
              <button
                type="button"
                aria-label={`Remover ${arquivo.name}`}
                onClick={() => onRemover(indice)}
                // A área de toque passa de 44×44 px sem aumentar a etiqueta.
                className="relative text-suave after:absolute after:-inset-4 after:content-[''] hover:text-forte"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
