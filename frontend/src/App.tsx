import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  LoaderCircle,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Status = 'OK' | 'REVISAR';

type Registro = {
  id: number;
  arquivo: string;
  referencia: string;
  municipio: string;
  cpf: string;
  nis: string;
  nome: string;
  motivo: string;
  status: Status;
  inconsistencias: string[];
};

type EditableField = 'municipio' | 'cpf' | 'nis' | 'nome' | 'motivo';

const FIELDS: EditableField[] = ['municipio', 'cpf', 'nis', 'nome', 'motivo'];

function inconsistenciesOf(record: Registro): string[] {
  const missing = FIELDS.filter((field) => !record[field]?.trim()).map((field) => field.toUpperCase());
  if (record.cpf && record.cpf.trim().length !== 11) {
    missing.push('CPF inválido');
  }
  return missing;
}

function withStatus(record: Registro): Registro {
  const issues = inconsistenciesOf(record);
  return { ...record, inconsistencias: issues, status: issues.length ? 'REVISAR' : 'OK' };
}

function uniqueValues(records: Registro[], field: EditableField) {
  return [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function downloadFile(path: string, records: Registro[], filename: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
  if (!response.ok) {
    throw new Error('Não foi possível gerar o arquivo.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [records, setRecords] = useState<Registro[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [issuesOpen, setIssuesOpen] = useState(true);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (municipalities.length && !municipalities.includes(record.municipio)) return false;
      if (reasons.length && !reasons.includes(record.motivo)) return false;
      if (statuses.length && !statuses.includes(record.status)) return false;
      return true;
    });
  }, [records, municipalities, reasons, statuses]);

  const okCount = records.filter((record) => record.status === 'OK').length;
  const reviewCount = records.filter((record) => record.status === 'REVISAR').length;
  const issues = records.filter((record) => record.inconsistencias.length);

  function adicionarArquivos(event: React.ChangeEvent<HTMLInputElement>) {
    setFiles((atuais) => [...atuais, ...Array.from(event.target.files ?? [])]);
    event.target.value = '';
  }

  async function processar() {
    if (!files.length) {
      setErro('Selecione ao menos um PDF.');
      return;
    }
    setCarregando(true);
    setErro('');
    const dados = new FormData();
    files.forEach((file) => dados.append('files', file));
    dados.append('ocrEnabled', String(ocrEnabled));
    try {
      const response = await fetch(`${API_URL}/processar`, { method: 'POST', body: dados });
      if (!response.ok) throw new Error('Não foi possível processar os arquivos.');
      const payload = await response.json() as { registros: Registro[] };
      setRecords(payload.registros.map(withStatus));
      setMunicipalities([]);
      setReasons([]);
      setStatuses([]);
      setIssuesOpen(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }

  function limpar() {
    setFiles([]);
    setRecords([]);
    setMunicipalities([]);
    setReasons([]);
    setStatuses([]);
    setErro('');
  }

  function atualizarCampo(id: number, field: EditableField, value: string) {
    setRecords((atuais) =>
      atuais.map((record) => (record.id === id ? withStatus({ ...record, [field]: value }) : record)),
    );
  }

  async function exportar(path: string, filename: string) {
    try {
      await downloadFile(path, records, filename);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao exportar.');
    }
  }

  return (
    <main className="app-shell min-h-screen px-4 py-8 text-slate-800 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-8 flex items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="eyebrow mb-2">Extração local de PDFs</p>
            <h1>Leitor de desligamentos</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Extração local de PDFs. Os arquivos ficam só em memória/temporário durante o processamento.
            </p>
          </div>
          <span className="status-chip hidden md:inline-flex">
            <span className="status-dot status-ok" />
            Local
          </span>
        </header>

        <section className="surface-card">
          <div className="section-heading">
            <div className="icon-badge">
              <Upload size={18} />
            </div>
            <div>
              <p className="eyebrow">Entrada</p>
              <h2>PDFs de desligamento</h2>
            </div>
            <span className="count-badge">{files.length}</span>
          </div>
          <label className="upload-zone">
            <Upload size={24} />
            <span className="font-semibold">Selecione os PDFs de desligamento</span>
            <span className="text-xs text-slate-500">Um ou mais arquivos .pdf</span>
            <input type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={adicionarArquivos} />
          </label>
          <ul className="mt-4 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="file-pill">
                <FileText size={14} />
                <span className="truncate">{file.name}</span>
                <button title="Remover arquivo" aria-label={`Remover ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <label className="checkbox-row mt-4">
            <input type="checkbox" checked={ocrEnabled} onChange={(event) => setOcrEnabled(event.target.checked)} />
            Usar OCR quando o PDF não tiver texto selecionável
          </label>
        </section>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={processar} disabled={carregando || !files.length} className="primary-button">
            {carregando ? <LoaderCircle className="animate-spin" size={18} /> : <Play size={18} />}
            Processar arquivos
          </button>
          <button onClick={limpar} className="outline-button">
            <Trash2 size={16} />
            Limpar dados
          </button>
        </div>
        {erro && <p className="error-message">{erro}</p>}

        {!records.length ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Envie um ou mais PDFs e clique em Processar arquivos para começar.
          </p>
        ) : (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="metric"><span>Arquivos</span><strong>{records.length}</strong></div>
              <div className="metric"><span>OK</span><strong>{okCount}</strong></div>
              <div className="metric"><span>REVISAR</span><strong>{reviewCount}</strong></div>
            </section>

            <section className="surface-card mt-6">
              <div className="section-heading">
                <div className="icon-badge"><Filter size={18} /></div>
                <div>
                  <p className="eyebrow">Consulta</p>
                  <h2>Filtros</h2>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm text-slate-600">
                  Município
                  <select multiple className="filter-select mt-2" value={municipalities} onChange={(event) => setMunicipalities(Array.from(event.target.selectedOptions, (option) => option.value))}>
                    {uniqueValues(records, 'municipio').map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Motivo
                  <select multiple className="filter-select mt-2" value={reasons} onChange={(event) => setReasons(Array.from(event.target.selectedOptions, (option) => option.value))}>
                    {uniqueValues(records, 'motivo').map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Status
                  <select multiple className="filter-select mt-2" value={statuses} onChange={(event) => setStatuses(Array.from(event.target.selectedOptions, (option) => option.value as Status))}>
                    <option value="OK">OK</option>
                    <option value="REVISAR">REVISAR</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="surface-card mt-6 p-0">
              <div className="border-b border-slate-200 p-5">
                <p className="eyebrow">Resultados</p>
                <h2>Tabela editável</h2>
              </div>
              <div className="table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Arquivo</th>
                      <th>Referencia</th>
                      <th>Município</th>
                      <th>CPF</th>
                      <th>NIS</th>
                      <th>Nome</th>
                      <th>Motivo</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => (
                      <tr key={record.id}>
                        <td>{record.arquivo}</td>
                        <td>{record.referencia}</td>
                        {FIELDS.map((field) => (
                          <td key={field}>
                            <input
                              className="cell-input"
                              value={record[field]}
                              onChange={(event) => atualizarCampo(record.id, field, event.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <span className={`status-label status-${record.status.toLowerCase()}`}>
                            <span className={`status-dot status-${record.status.toLowerCase()}`} />
                            {record.status === 'OK' ? 'OK' : 'REVISAR'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {issues.length > 0 && (
              <section className="surface-card mt-6">
                <button className="section-heading w-full text-left" onClick={() => setIssuesOpen((open) => !open)}>
                  <div className="icon-badge"><AlertTriangle size={18} /></div>
                  <div>
                    <p className="eyebrow">Qualidade</p>
                    <h2>Inconsistências ({issues.length})</h2>
                  </div>
                </button>
                {issuesOpen && (
                  <div className="table-wrap">
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th>Arquivo</th>
                          <th>Inconsistências</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issues.map((record) => (
                          <tr key={record.id}>
                            <td>{record.arquivo}</td>
                            <td>{record.inconsistencias.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <section className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button className="primary-button" onClick={() => exportar('/exportar/xlsx', 'desligamentos.xlsx')}>
                <Download size={16} /> Baixar XLSX
              </button>
              <button className="outline-button" onClick={() => exportar('/exportar/csv', 'desligamentos.csv')}>
                <Download size={16} /> Baixar CSV UTF-8
              </button>
              <button className="outline-button" disabled={!reviewCount} onClick={() => exportar('/exportar/xlsx-revisar', 'desligamentos_revisar.xlsx')}>
                <CheckCircle2 size={16} /> Baixar somente REVISAR
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
