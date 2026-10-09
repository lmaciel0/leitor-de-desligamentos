// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BarraTriagem } from './BarraTriagem';

describe('BarraTriagem', () => {
  it('mostra as contagens e marca o status ativo', () => {
    render(<BarraTriagem ok={18} revisar={6} statusAtivo="REVISAR" onAlternar={() => {}} />);
    expect(screen.getByRole('button', { name: /18 OK/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /6 REVISAR/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar em um trecho pede para alternar aquele status', async () => {
    const onAlternar = vi.fn();
    render(<BarraTriagem ok={18} revisar={6} statusAtivo={null} onAlternar={onAlternar} />);
    await userEvent.click(screen.getByRole('button', { name: /6 REVISAR/ }));
    expect(onAlternar).toHaveBeenCalledWith('REVISAR');
  });

  it('não mostra o trecho de um status sem registros', () => {
    render(<BarraTriagem ok={5} revisar={0} statusAtivo={null} onAlternar={() => {}} />);
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 OK/ })).toBeInTheDocument();
  });

  it('mantém o trecho do filtro ativo mesmo com zero registros, para o usuário poder desativá-lo', async () => {
    const onAlternar = vi.fn();
    render(<BarraTriagem ok={5} revisar={0} statusAtivo="REVISAR" onAlternar={onAlternar} />);
    await userEvent.click(screen.getByRole('button', { name: /0 REVISAR/ }));
    expect(onAlternar).toHaveBeenCalledWith('REVISAR');
  });
});
