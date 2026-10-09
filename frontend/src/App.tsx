import { LoaderCircle, Play, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { BarraExportar } from './components/BarraExportar';
import { BarraTriagem } from './components/BarraTriagem';
import { Filtros } from './components/Filtros';
import { TabelaResultados } from './components/TabelaResultados';
import { ZonaUpload } from './components/ZonaUpload';
import { normalizarCampo, recalcular } from './lib/parser/campos';
import { processarLote } from './lib/processar';
import type { CampoEditavel, DesligamentoRecord, Status } from './tipos';

/** Os selecionados entram na lista mesmo que uma edição tenha eliminado o valor, para o usuário poder desmarcá-los. */
function valoresUnicos(registros: DesligamentoRecord[], campo: 'municipio' | 'motivo', selecionados: string[]): string[] {
  return [...new Set([...registros.map((registro) => registro[campo]).filter(Boolean), ...selecionados])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

export default function App() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [registros, setRegistros] = useState<DesligamentoRecord[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [statusAtivo, setStatusAtivo] = useState<Status | null>(null);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [erro, setErro] = useState('');
  const controladorRef = useRef<AbortController | null>(null);

  const visiveis = useMemo(
    () =>
      registros.filter((registro) => {
        // A linha em edição fica visível mesmo que a edição mude seu status.
        if (registro.id === idEmEdicao) return true;
        if (municipios.length && !municipios.includes(registro.municipio)) return false;
        if (motivos.length && !motivos.includes(registro.motivo)) return false;
        if (statusAtivo && registro.status !== statusAtivo) return false;
        return true;
      }),
    [registros, municipios, motivos, statusAtivo, idEmEdicao],
  );

  const totalOk = registros.filter((registro) => registro.status === 'OK').length;
  const totalRevisar = registros.length - totalOk;

  function zerarFiltros() {
    setMunicipios([]);
    setMotivos([]);
    setStatusAtivo(null);
    setIdEmEdicao(null);
  }

  async function processar() {
    if (!arquivos.length) {
      setErro('Selecione ao menos um PDF.');
      return;
    }
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;
    setCarregando(true);
    setErro('');
    setProgresso({ feitos: 0, total: arquivos.length });
    try {
      const resultado = await processarLote(arquivos, new Date(), {
        signal: controlador.signal,
        onProgresso: (feitos, total) => {
          if (!controlador.signal.aborted) setProgresso({ feitos, total });
        },
      });
      if (controlador.signal.aborted) return;
      setRegistros(resultado);
      zerarFiltros();
    } catch (falha) {
      if (!controlador.signal.aborted) setErro(falha instanceof Error ? falha.message : 'Erro inesperado.');
    } finally {
      if (controladorRef.current === controlador) {
        controladorRef.current = null;
        setCarregando(false);
      }
    }
  }

  function limpar() {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setCarregando(false);
    setArquivos([]);
    setRegistros([]);
    setErro('');
    zerarFiltros();
  }

  function editar(id: number, campo: CampoEditavel, valor: string) {
    setRegistros((atuais) =>
      atuais.map((registro) => (registro.id === id ? recalcular({ ...registro, [campo]: normalizarCampo(campo, valor) }) : registro)),
    );
  }

  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-eclipse text-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-10">
          <h1 className="text-3xl md:text-4xl">Leitor de desligamentos</h1>
          <p className="text-sm text-white/80">Seus PDFs não saem deste computador.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-8 pt-6 md:px-10">
        <ZonaUpload
          arquivos={arquivos}
          onAdicionar={(novos) => setArquivos((atuais) => [...atuais, ...novos])}
          onRemover={(indice) => setArquivos((atuais) => atuais.filter((_, posicao) => posicao !== indice))}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="botao-primario" onClick={processar} disabled={carregando}>
            {carregando ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {carregando ? `Processando ${progresso.feitos} de ${progresso.total}` : 'Processar arquivos'}
          </button>
          <button type="button" className="botao-secundario" onClick={limpar}>
            <Trash2 size={16} aria-hidden="true" />
            Limpar dados
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-sm font-medium text-tijolo">
            {erro}
          </p>
        )}

        {registros.length === 0 ? (
          <p className="mt-10 text-sm text-suave">Escolha um ou mais PDFs e clique em Processar arquivos.</p>
        ) : (
          <section className="mt-8 space-y-4" aria-label="Resultados">
            <BarraTriagem
              ok={totalOk}
              revisar={totalRevisar}
              statusAtivo={statusAtivo}
              onAlternar={(status) => setStatusAtivo((atual) => (atual === status ? null : status))}
            />
            <Filtros
              municipios={valoresUnicos(registros, 'municipio', municipios)}
              motivos={valoresUnicos(registros, 'motivo', motivos)}
              municipiosSelecionados={municipios}
              motivosSelecionados={motivos}
              onMunicipios={setMunicipios}
              onMotivos={setMotivos}
            />
            <TabelaResultados
              registros={visiveis}
              onEditar={editar}
              onIniciarEdicao={setIdEmEdicao}
              onEncerrarEdicao={() => setIdEmEdicao(null)}
            />
          </section>
        )}
      </main>

      {registros.length > 0 && <BarraExportar registros={registros} onErro={setErro} />}
    </div>
  );
}
