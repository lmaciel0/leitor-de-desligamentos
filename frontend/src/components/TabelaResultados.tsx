import { Fragment, useState, type FocusEvent } from 'react';
import {
  CAMPOS_CONFERENCIA,
  CAMPOS_EDITAVEIS,
  TITULOS_CONFERENCIA,
  type CampoConferencia,
  type CampoEditavel,
  type DesligamentoRecord,
} from '../tipos';
import { ImagemDaPagina } from './ImagemDaPagina';

interface Props {
  registros: DesligamentoRecord[];
  onEditar: (id: number, campo: CampoEditavel, valor: string) => void;
  onConferir: (id: number, campo: CampoConferencia, marcado: boolean) => void;
  onIniciarEdicao: (id: number) => void;
  onEncerrarEdicao: () => void;
}

const TITULOS: Record<CampoEditavel, string> = {
  municipio: 'Município',
  cpf: 'CPF',
  nis: 'NIS',
  nib: 'NIB',
  nome: 'Nome',
  motivo: 'Motivo',
};

const CAMPOS_NUMERICOS: readonly CampoEditavel[] = ['cpf', 'nis', 'nib'];
const CAMPOS_LONGOS: readonly CampoEditavel[] = ['nome', 'motivo'];
const ROTULOS_CURTOS: Record<CampoConferencia, string> = {
  municipioConfere: 'Município',
  validado: 'Validado',
  recebeCmic: 'CMIC',
};

// Larguras fixas (soma 60rem); Nome e Motivo dividem o que sobra da tabela (mínimo 80rem).
const LARGURAS_COLUNAS = ['w-36', 'w-36', 'w-[7.5rem]', 'w-[7.5rem]', 'w-28', null, null, 'w-52', 'w-28'] as const;
const CABECALHOS = ['Arquivo', ...CAMPOS_EDITAVEIS.map((campo) => TITULOS[campo]), 'Conferências', 'Status'];

const ETIQUETA = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold';
const COLUNAS = CABECALHOS.length;

function ListaDePendencias({ registro }: { registro: DesligamentoRecord }) {
  return (
    <ul id={`pendencias-${registro.id}`} aria-label={`Pendências de ${registro.arquivo}`} className="list-disc pl-5 text-sm">
      {registro.inconsistencias.map((pendencia, indice) => (
        <li key={`${indice}-${pendencia}`}>{pendencia}</li>
      ))}
    </ul>
  );
}

export function TabelaResultados({ registros, onEditar, onConferir, onIniciarEdicao, onEncerrarEdicao }: Props) {
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
    <div className="relative overflow-x-auto rounded-cartao border border-linha bg-superficie shadow-cartao min-[1366px]:overflow-visible">
      <table className="w-full min-w-[80rem] table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Resultados do processamento</caption>
        <colgroup>
          {LARGURAS_COLUNAS.map((largura, indice) => (
            <col key={CABECALHOS[indice]} className={largura ?? undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-suave">
            {CABECALHOS.map((titulo) => (
              <th key={titulo} scope="col" className="sticky top-0 z-10 whitespace-nowrap border-b border-linha bg-superficie px-3 py-3 font-semibold">
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
                <tr className={`animate-entrar border-b border-linha ${revisar ? 'bg-coral-fundo' : ''}`}>
                  <td className={`px-3 py-2 align-top ${revisar ? 'shadow-[inset_3px_0_0_rgb(var(--coral))]' : ''}`}>
                    <div title={registro.arquivo} className="truncate">
                      {registro.arquivo}
                    </div>
                    <div className="tabular text-xs text-suave">
                      <span className="sr-only">Referência: </span>
                      {registro.referencia}
                    </div>
                  </td>
                  {CAMPOS_EDITAVEIS.map((campo) => {
                    const propriedades = {
                      'aria-label': `${TITULOS[campo]} de ${registro.arquivo}`,
                      value: registro[campo],
                      onFocus: () => onIniciarEdicao(registro.id),
                      onBlur: (evento: FocusEvent<HTMLElement>) => {
                        // Passar para outra célula da mesma linha não encerra a edição.
                        const linha = evento.currentTarget.closest('tr');
                        if (!linha?.contains(evento.relatedTarget as Node | null)) onEncerrarEdicao();
                      },
                    };
                    return (
                      <td key={campo} className="px-1 py-1 align-top">
                        {CAMPOS_LONGOS.includes(campo) ? (
                          <div className="campo-texto" data-valor={registro[campo]}>
                            <textarea
                              {...propriedades}
                              rows={1}
                              className="campo-celula"
                              onKeyDown={(evento) => {
                                // O valor salvo nunca tem quebra de linha.
                                if (evento.key === 'Enter') evento.preventDefault();
                              }}
                              onChange={(evento) => onEditar(registro.id, campo, evento.target.value.replace(/\r?\n/g, ' '))}
                            />
                          </div>
                        ) : (
                          <input
                            {...propriedades}
                            className={`campo-celula ${CAMPOS_NUMERICOS.includes(campo) ? 'tabular' : ''}`}
                            onChange={(evento) => onEditar(registro.id, campo, evento.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 align-top">
                    <div className="flex justify-center gap-2">
                      {CAMPOS_CONFERENCIA.map((campo) => (
                        <label key={campo} className="flex min-h-[44px] min-w-[44px] cursor-pointer flex-col items-center justify-center">
                          <span aria-hidden="true" className="text-xs text-suave">
                            {ROTULOS_CURTOS[campo]}
                          </span>
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-forte"
                            aria-label={`${TITULOS_CONFERENCIA[campo]}: ${registro.arquivo}`}
                            checked={registro[campo]}
                            onChange={(evento) => onConferir(registro.id, campo, evento.target.checked)}
                          />
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    {revisar ? (
                      <button
                        type="button"
                        aria-expanded={aberto}
                        aria-controls={`pendencias-${registro.id}`}
                        onClick={() => alternar(registro.id)}
                        className="cursor-pointer rounded-full"
                      >
                        {/* A etiqueta é só visual; o nome acessível do botão continua REVISAR + contagem de pendências. */}
                        <span aria-hidden="true" className={`${ETIQUETA} animate-pulso-coral bg-coral-claro text-coral-texto`}>
                          Revisar · {registro.inconsistencias.length}
                        </span>
                        <span className="sr-only">
                          REVISAR
                          <span>{registro.inconsistencias.length} {registro.inconsistencias.length === 1 ? 'pendência' : 'pendências'}</span>
                        </span>
                      </button>
                    ) : (
                      <span className={`${ETIQUETA} bg-ok-fundo text-forte`}>OK</span>
                    )}
                  </td>
                </tr>
                {registro.lidoPorOcr ? (
                  <tr className={`border-b border-linha ${revisar ? 'bg-coral-fundo' : ''}`}>
                    <td colSpan={COLUNAS} className="px-3 py-3">
                      {/* Sticky: a tabela rola na horizontal e o painel precisa ficar à vista. */}
                      <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                        <ImagemDaPagina idDoRegistro={registro.id} arquivo={registro.arquivo}>
                          {revisar && aberto && <ListaDePendencias registro={registro} />}
                        </ImagemDaPagina>
                      </div>
                    </td>
                  </tr>
                ) : (
                  revisar &&
                  aberto && (
                    <tr className="border-b border-linha bg-coral-fundo">
                      <td colSpan={COLUNAS} className="px-3 pb-3 pl-6">
                        <ListaDePendencias registro={registro} />
                      </td>
                    </tr>
                  )
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
