import { FolderOpen, LoaderCircle, Play, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvisoReprocessar } from './components/AvisoReprocessar';
import { BarraExportar } from './components/BarraExportar';
import { BarraTriagem } from './components/BarraTriagem';
import { BotaoTema } from './components/BotaoTema';
import { Filtros } from './components/Filtros';
import { TabelaResultados } from './components/TabelaResultados';
import { ZonaUpload } from './components/ZonaUpload';
import { ehPdf, separarDuplicados } from './lib/arquivos';
import { baixarBlob } from './lib/exportar/baixar';
import { normalizarCampo, recalcular } from './lib/parser/campos';
import { processarLote } from './lib/processar';
import { aplicarTema, salvarTema, temaInicial, type Tema } from './lib/tema';
import { descreverData, gerarTrabalho, lerTrabalho, nomeDoArquivoDeTrabalho } from './lib/trabalho';
import type { CampoConferencia, CampoEditavel, DesligamentoRecord, Status } from './tipos';

/** Os selecionados entram na lista mesmo que uma edição tenha eliminado o valor, para o usuário poder desmarcá-los. */
function valoresUnicos(registros: DesligamentoRecord[], campo: 'municipio' | 'motivo', selecionados: string[]): string[] {
  return [...new Set([...registros.map((registro) => registro[campo]).filter(Boolean), ...selecionados])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

/** Um trabalho de 5000 registros fica bem abaixo disso; acima, nem tentamos ler. */
const MAX_MB_TRABALHO = 50;

type TrabalhoLido = ReturnType<typeof lerTrabalho>;

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
  const [trabalhoPendente, setTrabalhoPendente] = useState<TrabalhoLido | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const [tema, setTema] = useState<Tema>(temaInicial);
  const controladorRef = useRef<AbortController | null>(null);
  const botaoProcessar = useRef<HTMLButtonElement>(null);
  const entradaTrabalho = useRef<HTMLInputElement>(null);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  function alternarTema() {
    const proximo: Tema = tema === 'escuro' ? 'claro' : 'escuro';
    setTema(proximo);
    salvarTema(proximo);
  }

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
    setTrabalhoPendente(null);
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

  function salvarTrabalho() {
    const agora = new Date();
    baixarBlob(new Blob([gerarTrabalho(registros, agora)], { type: 'application/json' }), nomeDoArquivoDeTrabalho(agora));
    setAviso('Trabalho salvo. O arquivo contém CPF e NIS: guarde-o em local seguro.');
  }

  async function escolherTrabalho(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro('');
    try {
      if (arquivo.size > MAX_MB_TRABALHO * 1024 * 1024) {
        throw new Error(`o arquivo passa de ${MAX_MB_TRABALHO} MB.`);
      }
      const lido = lerTrabalho(await arquivo.text());
      setConfirmando(false);
      // Com resultados na tela, abrir o trabalho os substitui: pede confirmação antes.
      if (registros.length > 0) setTrabalhoPendente(lido);
      else aplicarTrabalho(lido);
    } catch (falha) {
      setErro(`Não foi possível abrir o trabalho: ${falha instanceof Error ? falha.message : String(falha)}`);
    }
  }

  function aplicarTrabalho({ registros: lidos, salvoEm }: TrabalhoLido) {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setCarregando(false);
    setTrabalhoPendente(null);
    setArquivos([]);
    setRegistros(lidos);
    setEditadas(new Set());
    zerarFiltros();
    // O aviso visível já é uma região status (anunciada); não repetir na região só para leitores de tela.
    setAnuncio('');
    setAviso(`Trabalho aberto: ${lidos.length} ${plural(lidos.length, 'registro', 'registros')}, salvo em ${descreverData(salvoEm)}.`);
  }

  function cancelarAbertura() {
    setTrabalhoPendente(null);
    entradaTrabalho.current?.focus();
  }

  function limpar() {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setCarregando(false);
    setConfirmando(false);
    setTrabalhoPendente(null);
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

  /** As marcações de conferência são do operador: não mudam o status e contam como edição ao reprocessar. */
  function conferir(id: number, campo: CampoConferencia, marcado: boolean) {
    setEditadas((atuais) => new Set(atuais).add(id));
    setRegistros((atuais) => atuais.map((registro) => (registro.id === id ? { ...registro, [campo]: marcado } : registro)));
  }

  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-eclipse text-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-10">
          <h1 className="text-3xl md:text-4xl">Leitor de desligamentos</h1>
          <div className="flex flex-col gap-3 md:items-end">
            <BotaoTema escuro={tema === 'escuro'} onAlternar={alternarTema} />
            <p className="text-sm text-white/80">Seus PDFs não saem deste computador.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-8 pt-6 md:px-10">
        <ZonaUpload
          arquivos={arquivos}
          onAdicionar={adicionar}
          onRemover={(indice) => setArquivos((atuais) => atuais.filter((_, posicao) => posicao !== indice))}
        />
        {aviso && (
          <p role="status" className="mt-3 text-sm text-forte">
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
          <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
            <label className="botao-secundario cursor-pointer focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-denim">
              <FolderOpen size={16} aria-hidden="true" />
              Abrir trabalho
              <input
                ref={entradaTrabalho}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Abrir trabalho"
                onChange={(evento) => {
                  void escolherTrabalho(evento.target.files?.[0]);
                  evento.target.value = '';
                }}
              />
            </label>
            <button type="button" className="botao-secundario" onClick={salvarTrabalho} disabled={registros.length === 0}>
              <Save size={16} aria-hidden="true" />
              Salvar trabalho
            </button>
          </div>
        </div>
        {confirmando && (
          <AvisoReprocessar linhasEditadas={editadas.size} onConfirmar={() => void processar()} onCancelar={cancelarReprocesso} />
        )}
        {trabalhoPendente && (
          <AvisoReprocessar
            titulo="Abrir trabalho?"
            rotuloConfirmar="Abrir trabalho"
            linhasEditadas={editadas.size}
            onConfirmar={() => aplicarTrabalho(trabalhoPendente)}
            onCancelar={cancelarAbertura}
          />
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
              onConferir={conferir}
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
