import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Menu = 'municipio' | 'motivo';

interface MenuProps {
  titulo: string;
  opcoes: string[];
  selecionados: string[];
  aberto: boolean;
  onAlternar: () => void;
  onChange: (valores: string[]) => void;
  botaoRef: (elemento: HTMLButtonElement | null) => void;
}

function MenuFiltro({ titulo, opcoes, selecionados, aberto, onAlternar, onChange, botaoRef }: MenuProps) {
  const resumo = selecionados.length ? `${titulo} (${selecionados.length})` : titulo;
  const idDoPainel = `filtro-${titulo.toLowerCase()}`;
  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        aria-expanded={aberto}
        aria-controls={idDoPainel}
        onClick={onAlternar}
        className="flex items-center gap-2 rounded-md border border-denim bg-superficie min-h-[44px] px-3 text-sm text-forte"
      >
        {resumo}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          id={idDoPainel}
          role="group"
          aria-label={titulo}
          className="absolute z-20 mt-1 max-h-72 min-w-[16rem] overflow-auto rounded-md border border-denim bg-superficie p-2 shadow-lg"
        >
          {opcoes.length === 0 && <p className="px-2 py-1 text-sm text-suave">Nenhum valor encontrado.</p>}
          {opcoes.map((opcao) => (
            <label key={opcao} className="flex cursor-pointer items-center gap-2 min-h-[44px] rounded px-2 text-sm hover:bg-denim-claro">
              <input
                type="checkbox"
                checked={selecionados.includes(opcao)}
                onChange={() =>
                  onChange(selecionados.includes(opcao) ? selecionados.filter((valor) => valor !== opcao) : [...selecionados, opcao])
                }
              />
              {opcao}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  municipios: string[];
  motivos: string[];
  municipiosSelecionados: string[];
  motivosSelecionados: string[];
  onMunicipios: (valores: string[]) => void;
  onMotivos: (valores: string[]) => void;
}

export function Filtros(props: Props) {
  const [aberto, setAberto] = useState<Menu | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<Record<Menu, HTMLButtonElement | null>>({ municipio: null, motivo: null });

  // Com um menu aberto: clicar fora, apertar Esc ou sair com Tab fecha o menu.
  useEffect(() => {
    if (!aberto) return;
    const conjunto = raiz.current;
    function aoClicar(evento: PointerEvent) {
      if (!conjunto?.contains(evento.target as Node)) setAberto(null);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || !aberto) return;
      botoes.current[aberto]?.focus();
      setAberto(null);
    }
    function aoSairDoFoco(evento: FocusEvent) {
      if (!conjunto?.contains(evento.relatedTarget as Node | null)) setAberto(null);
    }
    document.addEventListener('pointerdown', aoClicar);
    // Esc só com o foco nos filtros, para não fechar outra coisa aberta na tela.
    conjunto?.addEventListener('keydown', aoTeclar);
    conjunto?.addEventListener('focusout', aoSairDoFoco);
    return () => {
      document.removeEventListener('pointerdown', aoClicar);
      conjunto?.removeEventListener('keydown', aoTeclar);
      conjunto?.removeEventListener('focusout', aoSairDoFoco);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="flex flex-wrap gap-3">
      <MenuFiltro
        titulo="Município"
        opcoes={props.municipios}
        selecionados={props.municipiosSelecionados}
        aberto={aberto === 'municipio'}
        onAlternar={() => setAberto((atual) => (atual === 'municipio' ? null : 'municipio'))}
        onChange={props.onMunicipios}
        botaoRef={(elemento) => {
          botoes.current.municipio = elemento;
        }}
      />
      <MenuFiltro
        titulo="Motivo"
        opcoes={props.motivos}
        selecionados={props.motivosSelecionados}
        aberto={aberto === 'motivo'}
        onAlternar={() => setAberto((atual) => (atual === 'motivo' ? null : 'motivo'))}
        onChange={props.onMotivos}
        botaoRef={(elemento) => {
          botoes.current.motivo = elemento;
        }}
      />
    </div>
  );
}
