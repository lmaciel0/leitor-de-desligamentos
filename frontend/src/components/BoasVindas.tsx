import { FolderOpen, Upload } from 'lucide-react';
import { useState, type RefObject } from 'react';

interface Props {
  /** Recebe tudo o que foi escolhido ou solto; quem usa decide o que é PDF e avisa o que ignorou. */
  onAdicionar: (arquivos: File[]) => void;
  onAbrirTrabalho: (arquivo: File | undefined) => void;
  entradaTrabalho: RefObject<HTMLInputElement>;
}

/** Folha de papel desenhada; as cores vêm dos tokens, então valem nos dois temas. */
function Folha({ classe, destaque = false }: { classe: string; destaque?: boolean }) {
  return (
    <svg
      data-testid="folha"
      viewBox="0 0 46 58"
      width="46"
      height="58"
      aria-hidden="true"
      className={`absolute transition-transform ease-[var(--curva)] [transition-duration:var(--duracao-curta)] ${classe}`}
    >
      <rect x="1" y="1" width="44" height="56" rx="6" className={`fill-superficie ${destaque ? 'stroke-coral' : 'stroke-apagado'}`} strokeWidth="1.5" />
      <path d="M9 14h28M9 21h28M9 28h20" className="stroke-linha" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ANEL = 'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-anel';

export function BoasVindas({ onAdicionar, onAbrirTrabalho, entradaTrabalho }: Props) {
  const [arrastando, setArrastando] = useState(false);
  // O movimento só desloca as folhas: nada aqui bloqueia o soltar.
  const sobe = arrastando ? '-translate-y-1.5' : '';

  return (
    <div className="mx-auto mt-6 w-full max-w-[520px] text-center md:mt-12">
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
        className={`block cursor-pointer rounded-[18px] border-2 border-dashed bg-superficie/60 p-6 transition-colors [transition-duration:var(--duracao-curta)] ${ANEL} ${
          arrastando ? 'border-coral' : 'border-linha'
        }`}
      >
        {/* Os filhos não recebem o ponteiro: o dragleave só dispara ao sair do cartão. */}
        <div className="pointer-events-none">
          <div className="relative mx-auto h-[70px] w-[120px]">
            <Folha classe={`left-[10px] top-2 ${arrastando ? '-rotate-[10deg]' : '-rotate-[4deg]'} ${sobe}`} />
            <Folha classe={`left-[64px] top-2 ${arrastando ? 'rotate-[10deg]' : 'rotate-[4deg]'} ${sobe}`} />
            <Folha classe={`left-[37px] top-0.5 ${sobe}`} destaque />
          </div>
          <h2 className="mt-2 font-titulo text-xl font-extrabold text-forte">Solte os termos de desligamento aqui</h2>
          <p className="mt-1 text-sm text-suave">PDF digital ou escaneado. Nada sai deste computador.</p>
          <span className="botao-primario mt-4">
            <Upload size={16} aria-hidden="true" />
            Escolher PDFs
          </span>
        </div>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          aria-label="Escolher PDFs ou soltar aqui: escolha arquivos"
          onChange={(evento) => {
            onAdicionar(Array.from(evento.target.files ?? []));
            evento.target.value = '';
          }}
        />
      </label>
      {/* Fora do rótulo acima: um seletor de arquivo não pode morar dentro do outro. */}
      <label className={`botao-secundario mt-3 cursor-pointer ${ANEL}`}>
        <FolderOpen size={16} aria-hidden="true" />
        Abrir trabalho salvo
        <input
          ref={entradaTrabalho}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Abrir trabalho"
          onChange={(evento) => {
            onAbrirTrabalho(evento.target.files?.[0]);
            evento.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
