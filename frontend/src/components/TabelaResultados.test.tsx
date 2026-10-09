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
    municipioConfere: false,
    validado: false,
    recebeCmic: false,
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const acoes = { onEditar: () => {}, onConferir: () => {}, onIniciarEdicao: () => {}, onEncerrarEdicao: () => {} };

describe('TabelaResultados', () => {
  it('editar uma célula informa id, campo e valor', async () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({ nome: '' })]} />);
    await userEvent.type(screen.getByLabelText('Nome de a.pdf'), 'B');
    expect(onEditar).toHaveBeenCalledWith(1, 'nome', 'B');
  });

  it('avisa o início e o fim da edição de uma célula', async () => {
    const onIniciarEdicao = vi.fn();
    const onEncerrarEdicao = vi.fn();
    render(<TabelaResultados {...acoes} onIniciarEdicao={onIniciarEdicao} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({})]} />);
    await userEvent.click(screen.getByLabelText('CPF de a.pdf'));
    expect(onIniciarEdicao).toHaveBeenCalledWith(1);
    await userEvent.click(document.body);
    expect(onEncerrarEdicao).toHaveBeenCalled();
  });

  it('só encerra a edição quando o foco sai da linha, não ao passar para outra célula da mesma linha', async () => {
    const onEncerrarEdicao = vi.fn();
    render(
      <TabelaResultados {...acoes} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({}), registro({ id: 2, arquivo: 'b.pdf' })]} />,
    );
    await userEvent.click(screen.getByLabelText('CPF de a.pdf'));
    await userEvent.tab();
    expect(screen.getByLabelText('NIS de a.pdf')).toHaveFocus();
    expect(onEncerrarEdicao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('CPF de b.pdf'));
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

  it('tem legenda e cabeçalhos de coluna para leitores de tela', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    expect(screen.getByRole('table', { name: 'Resultados do processamento' })).toBeInTheDocument();
    const cabecalhos = screen.getAllByRole('columnheader');
    expect(cabecalhos.length).toBeGreaterThan(0);
    expect(cabecalhos.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });

  it('o botão REVISAR aponta para a lista de pendências que ele abre', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF'], cpf: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    const botao = screen.getByRole('button', { name: /REVISAR/ });
    await userEvent.click(botao);
    const lista = screen.getByRole('list', { name: 'Pendências de a.pdf' });
    expect(lista.id).not.toBe('');
    expect(botao).toHaveAttribute('aria-controls', lista.id);
  });

  it('mostra as três colunas de conferência, desmarcadas por padrão e com rótulo por linha', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    for (const titulo of ['Município confere', 'Está validado', 'Recebe CMIC']) {
      expect(screen.getByRole('columnheader', { name: titulo })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: titulo + ': a.pdf' })).not.toBeChecked();
    }
  });

  it('marcar uma conferência informa id, campo e novo valor, e reflete o valor recebido', async () => {
    const onConferir = vi.fn();
    const { rerender } = render(<TabelaResultados {...acoes} onConferir={onConferir} registros={[registro({})]} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Está validado: a.pdf' }));
    expect(onConferir).toHaveBeenCalledWith(1, 'validado', true);
    rerender(<TabelaResultados {...acoes} onConferir={onConferir} registros={[registro({ validado: true })]} />);
    expect(screen.getByRole('checkbox', { name: 'Está validado: a.pdf' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Recebe CMIC: a.pdf' })).not.toBeChecked();
  });

  it('explica quando nenhum registro corresponde aos filtros', () => {
    render(<TabelaResultados {...acoes} registros={[]} />);
    expect(screen.getByText('Nenhum registro corresponde aos filtros.')).toBeInTheDocument();
  });
});
