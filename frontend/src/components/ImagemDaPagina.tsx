import { Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { obterImagem } from '../lib/ocr/imagens';

interface Props {
  idDoRegistro: number;
  arquivo: string;
}

/** Página do PDF lida por OCR, para o operador comparar com os campos. A imagem vive só em memória (data URL). */
export function ImagemDaPagina({ idDoRegistro, arquivo }: Props) {
  const [ampliada, setAmpliada] = useState(false);
  const imagem = obterImagem(idDoRegistro);

  if (!imagem) {
    return (
      <p className="text-sm text-suave">Imagem da página não está disponível. Carregue o PDF de novo para conferir.</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" aria-pressed={ampliada} onClick={() => setAmpliada((atual) => !atual)} className="botao-secundario">
        {ampliada ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        {ampliada ? 'Reduzir' : 'Ampliar'}
      </button>
      <img
        src={imagem}
        alt={`Página do PDF ${arquivo}`}
        className={`rounded border border-denim/30 bg-white ${ampliada ? 'max-w-[min(100%,64rem)]' : 'max-h-56 max-w-full'}`}
      />
    </div>
  );
}
