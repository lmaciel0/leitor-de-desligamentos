// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvisoReprocessar } from './AvisoReprocessar';

describe('AvisoReprocessar', () => {
  it('é um alertdialog nomeado e o foco começa em "Cancelar", a opção segura', () => {
    render(<AvisoReprocessar linhasEditadas={0} onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('alertdialog', { name: 'Processar de novo?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('avisa que os resultados serão substituídos e quantas linhas editadas serão perdidas', () => {
    const { rerender } = render(<AvisoReprocessar linhasEditadas={0} onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('Isto substitui os resultados atuais.');
    rerender(<AvisoReprocessar linhasEditadas={1} onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Isto substitui os resultados atuais e descarta as suas edições em 1 linha.',
    );
    rerender(<AvisoReprocessar linhasEditadas={3} onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Isto substitui os resultados atuais e descarta as suas edições em 3 linhas.',
    );
  });

  it('Esc com o foco fora do aviso (por exemplo, numa célula da tabela) não cancela', async () => {
    const onCancelar = vi.fn();
    render(
      <>
        <input aria-label="célula" />
        <AvisoReprocessar linhasEditadas={0} onConfirmar={() => {}} onCancelar={onCancelar} />
      </>,
    );
    await userEvent.click(screen.getByLabelText('célula'));
    await userEvent.keyboard('{Escape}');
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('confirma, cancela e cancela com Esc', async () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<AvisoReprocessar linhasEditadas={0} onConfirmar={onConfirmar} onCancelar={onCancelar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Processar de novo' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onCancelar).toHaveBeenCalledTimes(2);
  });
});
