import { Download } from 'lucide-react';
import { baixarBlob } from '../lib/exportar/baixar';
import { somenteRevisar } from '../lib/exportar/colunas';
import { gerarCsv } from '../lib/exportar/csv';
import { gerarXlsx } from '../lib/exportar/xlsx';
import type { DesligamentoRecord } from '../tipos';

interface Props {
  registros: DesligamentoRecord[];
  onErro: (mensagem: string) => void;
  /** Chamada só depois de o download ser disparado sem erro. */
  onExportado: () => void;
}

export function BarraExportar({ registros, onErro, onExportado }: Props) {
  const pendentes = somenteRevisar(registros);

  async function exportar(gerar: () => Promise<Blob> | Blob, nomeDoArquivo: string) {
    try {
      baixarBlob(await gerar(), nomeDoArquivo);
      onExportado();
    } catch (erro) {
      onErro(erro instanceof Error ? `Não foi possível gerar o arquivo: ${erro.message}` : 'Não foi possível gerar o arquivo.');
    }
  }

  return (
    <section aria-label="Exportar resultados" className="sticky bottom-0 border-t border-linha bg-fundo/90 py-3 backdrop-blur">
      <div className="largura-pagina flex flex-col gap-3 sm:flex-row">
        <button type="button" className="botao-primario" onClick={() => exportar(() => gerarXlsx(registros), 'desligamentos.xlsx')}>
          <Download size={16} aria-hidden="true" />
          Baixar XLSX
        </button>
        <button
          type="button"
          className="botao-secundario"
          onClick={() => exportar(() => new Blob([gerarCsv(registros)], { type: 'text/csv;charset=utf-8' }), 'desligamentos.csv')}
        >
          <Download size={16} aria-hidden="true" />
          Baixar CSV
        </button>
        <button
          type="button"
          className="botao-secundario"
          disabled={pendentes.length === 0}
          onClick={() => exportar(() => gerarXlsx(pendentes), 'desligamentos_revisar.xlsx')}
        >
          <Download size={16} aria-hidden="true" />
          Baixar somente REVISAR
        </button>
        <p className="text-sm text-suave sm:ml-auto sm:self-center">
          Prefira o XLSX para CPF e NIS: ao abrir um CSV, o Excel remove os zeros à esquerda.
        </p>
      </div>
    </section>
  );
}
