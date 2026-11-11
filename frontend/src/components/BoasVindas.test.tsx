// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BoasVindas } from './BoasVindas';

const pdf = (nome: string) => new File(['x'], nome, { type: 'application/pdf' });

function montar(entradaTrabalho = createRef<HTMLInputElement>()) {
  const onAdicionar = vi.fn<(arquivos: File[]) => void>();
  const onAbrirTrabalho = vi.fn<(arquivo: File | undefined) => void>();
  render(<BoasVindas onAdicionar={onAdicionar} onAbrirTrabalho={onAbrirTrabalho} entradaTrabalho={entradaTrabalho} />);
  return { onAdicionar, onAbrirTrabalho };
}

describe('BoasVindas', () => {
  it('mostra o título, o subtítulo e o botão visual', () => {
    montar();
    expect(screen.getByRole('heading', { name: 'Solte os termos de desligamento aqui' })).toBeInTheDocument();
    expect(screen.getByText('PDF digital ou escaneado. Nada sai deste computador.')).toBeInTheDocument();
    expect(screen.getByText('Escolher PDFs')).toBeInTheDocument();
  });

  it('o rótulo raiz é a zona de upload e o seletor aceita vários PDFs', () => {
    montar();
    const zona = screen.getByTestId('zona-upload');
    expect(zona.tagName).toBe('LABEL');
    const entrada = screen.getByLabelText(/escolha arquivos/i);
    expect(zona).toContainElement(entrada);
    expect(entrada).toHaveAttribute('accept', 'application/pdf,.pdf');
    expect(entrada).toHaveAttribute('multiple');
  });

  it('adiciona os PDFs escolhidos no seletor', async () => {
    const { onAdicionar } = montar();
    await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), [pdf('a.pdf'), pdf('b.pdf')]);
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('soltar arquivos chama onAdicionar com todos eles', () => {
    const { onAdicionar } = montar();
    const texto = new File(['x'], 'nota.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getByTestId('zona-upload'), { dataTransfer: { files: [pdf('a.pdf'), texto] } });
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'nota.txt']);
  });

  it('arrastar por cima deixa a borda coral e abre as folhas; sair ou soltar desfaz', () => {
    montar();
    const zona = screen.getByTestId('zona-upload');
    const folhas = screen.getAllByTestId('folha');
    expect(folhas).toHaveLength(3);
    expect(zona).not.toHaveClass('border-coral');
    folhas.forEach((folha) => expect(folha).not.toHaveClass('-translate-y-1.5'));
    fireEvent.dragOver(zona);
    expect(zona).toHaveClass('border-coral');
    folhas.forEach((folha) => expect(folha).toHaveClass('-translate-y-1.5'));
    fireEvent.dragLeave(zona);
    expect(zona).not.toHaveClass('border-coral');
    fireEvent.dragOver(zona);
    fireEvent.drop(zona, { dataTransfer: { files: [] } });
    expect(zona).not.toHaveClass('border-coral');
  });

  it('o seletor de trabalho salvo usa o ref recebido e repassa o arquivo', async () => {
    const entradaTrabalho = createRef<HTMLInputElement>();
    const { onAbrirTrabalho } = montar(entradaTrabalho);
    const entrada = screen.getByLabelText('Abrir trabalho');
    expect(entrada).toBe(entradaTrabalho.current);
    expect(entrada).toHaveAttribute('accept', 'application/json,.json');
    expect(screen.getByText('Abrir trabalho salvo')).toBeInTheDocument();
    const trabalho = new File(['{}'], 'trabalho.json', { type: 'application/json' });
    await userEvent.upload(entrada, trabalho);
    expect(onAbrirTrabalho).toHaveBeenCalledWith(trabalho);
  });

  it('o seletor de trabalho fica fora da zona de upload (rótulo dentro de rótulo)', () => {
    montar();
    expect(screen.getByTestId('zona-upload')).not.toContainElement(screen.getByLabelText('Abrir trabalho'));
  });
});
