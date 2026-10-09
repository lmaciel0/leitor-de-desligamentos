import { Fragment, useState } from 'react';
import { CAMPOS_EDITAVEIS, type CampoEditavel, type DesligamentoRecord } from '../tipos';

interface Props {
  registros: DesligamentoRecord[];
  onEditar: (id: number, campo: CampoEditavel, valor: string) => void;
  onIniciarEdicao: (id: number) => void;
  onEncerrarEdicao: () => void;
}

const TITULOS: Record<CampoEditavel, string> = {
  municipio: 'Município',
  cpf: 'CPF',
  nis: 'NIS',
  nome: 'Nome',
  motivo: 'Motivo',
};

const CAMPOS_NUMERICOS: readonly CampoEditavel[] = ['cpf', 'nis'];
const CAMPOS_LONGOS: readonly CampoEditavel[] = ['nome', 'motivo'];
const COLUNAS = CAMPOS_EDITAVEIS.length + 3;

export function TabelaResultados({ registros, onEditar, onIniciarEdicao, onEncerrarEdicao }: Props) {
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  function alternar(id: number) {
    setExpandidos((atuais) => {
      const proximos = new Set(atuais);
      if (!proximos.delete(id)) proximos.add(id);
      return proximos;
    });
  }

  if (registros.length === 0) {
    return <p className="px-1 py-8 text-sm text-suave">Nenhum registro corresponde aos filtros.</p>;
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border border-denim/30 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-suave">
            {['Arquivo', 'Referência', ...CAMPOS_EDITAVEIS.map((campo) => TITULOS[campo]), 'Status'].map((titulo) => (
              <th key={titulo} className="sticky top-0 whitespace-nowrap border-b border-denim/30 bg-white px-3 py-3 font-semibold">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => {
            const revisar = registro.status === 'REVISAR';
            const aberto = expandidos.has(registro.id);
            return (
              <Fragment key={registro.id}>
                <tr className={`border-b border-denim/15 ${revisar ? 'bg-honey-claro' : ''}`}>
                  <td className={`whitespace-nowrap px-3 py-2 ${revisar ? 'shadow-[inset_4px_0_0_#E5D283]' : ''}`}>
                    {registro.arquivo}
                  </td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{registro.referencia}</td>
                  {CAMPOS_EDITAVEIS.map((campo) => (
                    <td key={campo} className="px-1 py-1">
                      <input
                        className={`campo-celula ${CAMPOS_NUMERICOS.includes(campo) ? 'tabular' : ''} ${CAMPOS_LONGOS.includes(campo) ? 'min-w-[16rem]' : ''}`}
                        aria-label={`${campo} de ${registro.arquivo}`}
                        value={registro[campo]}
                        onFocus={() => onIniciarEdicao(registro.id)}
                        onBlur={(evento) => {
                          // Passar para outra célula da mesma linha não encerra a edição.
                          const linha = evento.currentTarget.closest('tr');
                          if (!linha?.contains(evento.relatedTarget as Node | null)) onEncerrarEdicao();
                        }}
                        onChange={(evento) => onEditar(registro.id, campo, evento.target.value)}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">
                    {revisar ? (
                      <button
                        type="button"
                        aria-expanded={aberto}
                        onClick={() => alternar(registro.id)}
                        className="rounded px-2 py-1 text-eclipse underline decoration-eclipse/40 underline-offset-4"
                      >
                        REVISAR
                        <span className="ml-2 font-normal text-suave">
                          {registro.inconsistencias.length} {registro.inconsistencias.length === 1 ? 'pendência' : 'pendências'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-denim">OK</span>
                    )}
                  </td>
                </tr>
                {revisar && aberto && (
                  <tr className="border-b border-denim/15 bg-honey-claro">
                    <td colSpan={COLUNAS} className="px-3 pb-3 pl-6">
                      <ul aria-label={`Pendências de ${registro.arquivo}`} className="list-disc pl-5 text-sm">
                        {registro.inconsistencias.map((pendencia) => (
                          <li key={pendencia}>{pendencia}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
