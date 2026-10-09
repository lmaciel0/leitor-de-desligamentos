// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from '../tipos';
import { TabelaResultados } from './TabelaResultados';

function registro(parcial: Partial<DesligamentoRecord>): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '123',
    nib: '456',
    nome: 'ANA',
    motivo: 'Mudança',
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const acoes = { onEditar: () => {}, onIniciarEdicao: () => {}, onEncerrarEdicao: () => {} };

describe('TabelaResultados', () => {
  it('editar uma célula informa id, campo e valor', async () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({ nome: '' })]} />);
    await userEvent.type(screen.getByLabelText('nome de a.pdf'), 'B');
    expect(onEditar).toHaveBeenCalledWith(1, 'nome', 'B');
  });

  it('avisa o início e o fim da edição de uma célula', async () => {
    const onIniciarEdicao = vi.fn();
    const onEncerrarEdicao = vi.fn();
    render(<TabelaResultados {...acoes} onIniciarEdicao={onIniciarEdicao} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({})]} />);
    await userEvent.click(screen.getByLabelText('cpf de a.pdf'));
    expect(onIniciarEdicao).toHaveBeenCalledWith(1);
    await userEvent.click(document.body);
    expect(onEncerrarEdicao).toHaveBeenCalled();
  });

  it('só encerra a edição quando o foco sai da linha, não ao passar para outra célula da mesma linha', async () => {
    const onEncerrarEdicao = vi.fn();
    render(
      <TabelaResultados {...acoes} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({}), registro({ id: 2, arquivo: 'b.pdf' })]} />,
    );
    await userEvent.click(screen.getByLabelText('cpf de a.pdf'));
    await userEvent.tab();
    expect(screen.getByLabelText('nis de a.pdf')).toHaveFocus();
    expect(onEncerrarEdicao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('cpf de b.pdf'));
    expect(onEncerrarEdicao).toHaveBeenCalledTimes(1);
  });

  it('linha REVISAR mostra as pendências ao expandir', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF', 'NIS'], cpf: '', nis: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    expect(screen.queryByRole('list', { name: 'Pendências de a.pdf' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /REVISAR/ }));
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('CPF');
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('NIS');
  });

  it('linha OK mostra "OK" sem botão de pendências', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
  });

  it('explica quando nenhum registro corresponde aos filtros', () => {
    render(<TabelaResultados {...acoes} registros={[]} />);
    expect(screen.getByText('Nenhum registro corresponde aos filtros.')).toBeInTheDocument();
  });
});
