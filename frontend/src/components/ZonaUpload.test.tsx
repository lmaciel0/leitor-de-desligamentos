// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZonaUpload } from './ZonaUpload';

const pdf = (nome: string) => new File(['x'], nome, { type: 'application/pdf' });

describe('ZonaUpload', () => {
  it('lista os arquivos e permite removê-los', async () => {
    const onRemover = vi.fn();
    render(<ZonaUpload arquivos={[pdf('a.pdf'), pdf('b.pdf')]} onAdicionar={() => {}} onRemover={onRemover} />);
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover b.pdf' }));
    expect(onRemover).toHaveBeenCalledWith(1);
  });

  it('adiciona os PDFs escolhidos no seletor', async () => {
    const onAdicionar = vi.fn();
    render(<ZonaUpload arquivos={[]} onAdicionar={onAdicionar} onRemover={() => {}} />);
    await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), [pdf('a.pdf'), pdf('b.pdf')]);
    expect(onAdicionar).toHaveBeenCalledTimes(1);
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('ao soltar arquivos repassa todos; quem decide o que é PDF é o App, que avisa o que ignorar', () => {
    const onAdicionar = vi.fn();
    render(<ZonaUpload arquivos={[]} onAdicionar={onAdicionar} onRemover={() => {}} />);
    const zona = screen.getByTestId('zona-upload');
    const texto = new File(['x'], 'nota.txt', { type: 'text/plain' });
    fireEvent.drop(zona, { dataTransfer: { files: [pdf('a.pdf'), texto] } });
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'nota.txt']);
  });
});
