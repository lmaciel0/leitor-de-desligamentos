import { Maximize2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { obterImagem } from '../lib/ocr/imagens';
import { PaginaAmpliada } from './PaginaAmpliada';

interface Props {
  idDoRegistro: number;
  arquivo: string;
  /** Vai na coluna do título e do botão, abaixo deles (ex.: a lista de pendências). */
  children?: ReactNode;
}

/** Painel da página lida por OCR: a imagem à esquerda; título, "Ampliar" e os filhos à direita. A imagem vive só em memória (data URL). */
export function ImagemDaPagina({ idDoRegistro, arquivo, children }: Props) {
  const [ampliada, setAmpliada] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const imagem = obterImagem(idDoRegistro);

  function fechar() {
    setAmpliada(false);
    botao.current?.focus();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,auto)_minmax(16rem,1fr)]">
      {imagem && (
        <img
          src={imagem}
          alt={`Página do PDF ${arquivo}`}
          className="max-h-[60vh] w-auto max-w-full justify-self-start rounded border border-linha bg-white object-contain"
        />
      )}
      <div className="flex min-w-0 flex-col items-start gap-4">
        <p className="text-sm font-semibold">Página lida por OCR: {arquivo}</p>
        {imagem ? (
          <button ref={botao} type="button" aria-haspopup="dialog" onClick={() => setAmpliada(true)} className="botao-secundario">
            <Maximize2 size={16} aria-hidden="true" />
            Ampliar
          </button>
        ) : (
          <p className="text-sm text-suave">Imagem da página não está disponível. Carregue o PDF de novo para conferir.</p>
        )}
        {children}
      </div>
      {imagem && ampliada && <PaginaAmpliada imagem={imagem} arquivo={arquivo} onFechar={fechar} />}
    </div>
  );
}
