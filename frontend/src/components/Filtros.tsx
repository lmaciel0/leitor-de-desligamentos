import { ChevronDown } from 'lucide-react';

interface MenuProps {
  titulo: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
}

function MenuFiltro({ titulo, opcoes, selecionados, onChange }: MenuProps) {
  const resumo = selecionados.length ? `${titulo} (${selecionados.length})` : titulo;
  return (
    <details className="menu-filtro relative">
      <summary>
        {resumo}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 min-w-[16rem] overflow-auto rounded-md border border-denim/40 bg-white p-2 shadow-lg">
        {opcoes.length === 0 && <p className="px-2 py-1 text-sm text-suave">Nenhum valor encontrado.</p>}
        {opcoes.map((opcao) => (
          <label key={opcao} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-denim-claro">
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
    </details>
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
  return (
    <div className="flex flex-wrap gap-3">
      <MenuFiltro titulo="Município" opcoes={props.municipios} selecionados={props.municipiosSelecionados} onChange={props.onMunicipios} />
      <MenuFiltro titulo="Motivo" opcoes={props.motivos} selecionados={props.motivosSelecionados} onChange={props.onMotivos} />
    </div>
  );
}
