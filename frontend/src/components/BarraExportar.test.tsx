// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from '../tipos';

vi.mock('../lib/exportar/baixar', () => ({ baixarBlob: vi.fn() }));
// O XLSX real é coberto em lib/exportar; aqui só interessa quais registros chegam ao gerador.
vi.mock('../lib/exportar/xlsx', () => ({ gerarXlsx: vi.fn(async () => new Blob(['x'])) }));

import { baixarBlob } from '../lib/exportar/baixar';
import { gerarXlsx } from '../lib/exportar/xlsx';
import { BarraExportar } from './BarraExportar';

function registro(id: number, status: 'OK' | 'REVISAR'): DesligamentoRecord {
  return {
    id,
    arquivo: `${id}.pdf`,
    referencia: '09/10/2026',
    municipio: 'C',
    cpf: '12345678909',
    nis: '1',
    nome: 'N',
    motivo: 'M',
    status,
    inconsistencias: [],
  };
}

describe('BarraExportar', () => {
  beforeEach(() => {
    vi.mocked(baixarBlob).mockClear();
    vi.mocked(gerarXlsx).mockClear();
  });

  it('baixa o CSV com o nome esperado', async () => {
    render(<BarraExportar registros={[registro(1, 'OK')]} onErro={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }));
    expect(baixarBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(baixarBlob).mock.calls[0][1]).toBe('desligamentos.csv');
  });

  it('baixa o XLSX completo e o XLSX somente com REVISAR', async () => {
    render(<BarraExportar registros={[registro(1, 'OK'), registro(2, 'REVISAR')]} onErro={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar XLSX' }));
    await userEvent.click(screen.getByRole('button', { name: 'Baixar somente REVISAR' }));
    const nomes = vi.mocked(baixarBlob).mock.calls.map((chamada) => chamada[1]);
    expect(nomes).toEqual(['desligamentos.xlsx', 'desligamentos_revisar.xlsx']);
    expect(vi.mocked(gerarXlsx).mock.calls[0][0]).toHaveLength(2);
    expect(vi.mocked(gerarXlsx).mock.calls[1][0].map((r) => r.id)).toEqual([2]);
  });

  it('avisa que o XLSX é o formato seguro para CPF e NIS', () => {
    render(<BarraExportar registros={[registro(1, 'OK')]} onErro={() => {}} />);
    expect(screen.getByText(/Prefira o XLSX/)).toBeInTheDocument();
  });

  it('desabilita "somente REVISAR" quando não há registros REVISAR', () => {
    render(<BarraExportar registros={[registro(1, 'OK')]} onErro={() => {}} />);
    expect(screen.getByRole('button', { name: 'Baixar somente REVISAR' })).toBeDisabled();
  });
});
