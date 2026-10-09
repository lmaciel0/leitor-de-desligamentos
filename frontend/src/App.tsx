import { LoaderCircle, Play, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AvisoReprocessar } from './components/AvisoReprocessar';
import { BarraExportar } from './components/BarraExportar';
import { BarraTriagem } from './components/BarraTriagem';
import { Filtros } from './components/Filtros';
import { TabelaResultados } from './components/TabelaResultados';
import { ZonaUpload } from './components/ZonaUpload';
import { ehPdf, separarDuplicados } from './lib/arquivos';
import { normalizarCampo, recalcular } from './lib/parser/campos';
import { processarLote } from './lib/processar';
import type { CampoEditavel, DesligamentoRecord, Status } from './tipos';

/** Os selecionados entram na lista mesmo que uma edição tenha eliminado o valor, para o usuário poder desmarcá-los. */
function valoresUnicos(registros: DesligamentoRecord[], campo: 'municipio' | 'motivo', selecionados: string[]): string[] {
  return [...new Set([...registros.map((registro) => registro[campo]).filter(Boolean), ...selecionados])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function plural(quantidade: number, singular: string, pluralDaPalavra: string): string {
  return quantidade === 1 ? singular : pluralDaPalavra;
}

function avisoDeArquivos(repetidos: File[], naoPdf: File[]): string {
  const partes: string[] = [];
  if (repetidos.length) {
    const n = repetidos.length;
    partes.push(`${n} ${plural(n, 'arquivo repetido ignorado', 'arquivos repetidos ignorados')}: ${repetidos.map((f) => f.name).join(', ')}.`);
  }
  if (naoPdf.length) {
    const n = naoPdf.length;
    partes.push(`${n} ${plural(n, 'arquivo ignorado por não ser PDF', 'arquivos ignorados por não serem PDF')}: ${naoPdf.map((f) => f.name).join(', ')}.`);
  }
  return partes.join(' ');
}

export default function App() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [registros, setRegistros] = useState<DesligamentoRecord[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [statusAtivo, setStatusAtivo] = useState<Status | null>(null);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [editadas, setEditadas] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const controladorRef = useRef<AbortController | null>(null);
  const botaoProcessar = useRef<HTMLButtonElement>(null);

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

  async function adicionar(novos: File[]) {
    const pdfs = novos.filter(ehPdf);
    const naoPdf = novos.filter((arquivo) => !ehPdf(arquivo));
    const { aceitos, repetidos } = await separarDuplicados(arquivos, pdfs);
    setArquivos((atuais) => [...atuais, ...aceitos]);
    setAviso(avisoDeArquivos(repetidos, naoPdf));
  }

  /** Se já há resultados, reprocessar os substitui e descarta as edições: pede confirmação antes. */
  function pedirProcessamento() {
    if (registros.length > 0 && arquivos.length > 0) {
      setConfirmando(true);
      return;
    }
    void processar();
  }

  function cancelarReprocesso() {
    setConfirmando(false);
    botaoProcessar.current?.focus();
  }

  async function processar() {
    setConfirmando(false);
    if (!arquivos.length) {
      setErro('Selecione ao menos um PDF.');
      return;
    }
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;
    setCarregando(true);
    setErro('');
    setAviso('');
    setProgresso({ feitos: 0, total: arquivos.length });
    setAnuncio(`Processando ${arquivos.length} ${plural(arquivos.length, 'arquivo', 'arquivos')}.`);
    try {
      const resultado = await processarLote(arquivos, new Date(), {
        signal: controlador.signal,
        onProgresso: (feitos, total) => {
          if (!controlador.signal.aborted) setProgresso({ feitos, total });
        },
      });
      if (controlador.signal.aborted) return;
      setRegistros(resultado);
      setEditadas(new Set());
      zerarFiltros();
      const ok = resultado.filter((registro) => registro.status === 'OK').length;
      setAnuncio(
        `${resultado.length} ${plural(resultado.length, 'arquivo processado', 'arquivos processados')}: ${ok} OK, ${resultado.length - ok} REVISAR.`,
      );
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
    setConfirmando(false);
    setArquivos([]);
    setRegistros([]);
    setEditadas(new Set());
    setProgresso({ feitos: 0, total: 0 });
    setErro('');
    setAviso('');
    setAnuncio('');
    zerarFiltros();
  }

  function editar(id: number, campo: CampoEditavel, valor: string) {
    setEditadas((atuais) => new Set(atuais).add(id));
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
          onAdicionar={adicionar}
          onRemover={(indice) => setArquivos((atuais) => atuais.filter((_, posicao) => posicao !== indice))}
        />
        {aviso && (
          <p role="status" className="mt-3 text-sm text-eclipse">
            {aviso}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button ref={botaoProcessar} type="button" className="botao-primario" onClick={pedirProcessamento} disabled={carregando}>
            {carregando ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {carregando ? `Processando ${progresso.feitos} de ${progresso.total}` : 'Processar arquivos'}
          </button>
          <button type="button" className="botao-secundario" onClick={limpar}>
            <Trash2 size={16} aria-hidden="true" />
            Limpar dados
          </button>
        </div>
        {confirmando && (
          <AvisoReprocessar linhasEditadas={editadas.size} onConfirmar={() => void processar()} onCancelar={cancelarReprocesso} />
        )}
        {/* Região só para leitores de tela: anuncia o início e o fim do lote, sem repetir a cada arquivo. */}
        <p role="status" className="sr-only">
          {anuncio}
        </p>
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
