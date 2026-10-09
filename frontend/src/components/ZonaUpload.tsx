import { FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  arquivos: File[];
  onAdicionar: (arquivos: File[]) => void;
  onRemover: (indice: number) => void;
}

function ehPdf(arquivo: File): boolean {
  return arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
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
          onAdicionar(Array.from(evento.dataTransfer.files).filter(ehPdf));
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-5 py-6 text-eclipse focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-denim ${
          arrastando ? 'border-eclipse bg-denim-claro' : 'border-denim bg-white'
        }`}
      >
        <Upload size={22} aria-hidden="true" />
        <span className="font-medium">Solte os PDFs aqui ou escolha arquivos</span>
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
        <ul className="mt-3 flex flex-wrap gap-2">
          {arquivos.map((arquivo, indice) => (
            <li
              key={`${arquivo.name}-${indice}`}
              className="flex max-w-full items-center gap-2 rounded-full bg-denim-claro px-3 py-1.5 text-sm text-eclipse"
            >
              <FileText size={14} aria-hidden="true" />
              <span className="truncate">{arquivo.name}</span>
              <button
                type="button"
                aria-label={`Remover ${arquivo.name}`}
                onClick={() => onRemover(indice)}
                className="text-suave hover:text-tinta"
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
