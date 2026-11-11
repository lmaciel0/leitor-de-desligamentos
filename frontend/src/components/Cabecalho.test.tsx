// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Cabecalho } from './Cabecalho';

function montar() {
  render(<Cabecalho etapa="enviar" processando={false} escuro={false} onAlternarTema={() => {}} />);
  return {
    selo: screen.getByText('Local').closest('button') as HTMLButtonElement,
    balao: screen.getByRole('tooltip'),
  };
}

describe('Cabecalho: selo "Local"', () => {
  it('o balão começa fechado e abre ao focar ou passar o mouse', async () => {
    const { selo, balao } = montar();
    expect(balao).toHaveAttribute('data-aberto', 'false');
    await userEvent.tab();
    expect(selo).toHaveFocus();
    expect(balao).toHaveAttribute('data-aberto', 'true');
    act(() => selo.blur());
    expect(balao).toHaveAttribute('data-aberto', 'false');
    await userEvent.hover(selo);
    expect(balao).toHaveAttribute('data-aberto', 'true');
  });

  it('Esc fecha o balão sem tirar o foco; sair e voltar o abre de novo', async () => {
    const { selo, balao } = montar();
    act(() => selo.focus());
    expect(balao).toHaveAttribute('data-aberto', 'true');
    await userEvent.keyboard('{Escape}');
    expect(balao).toHaveAttribute('data-aberto', 'false');
    expect(selo).toHaveFocus();
    act(() => selo.blur());
    act(() => selo.focus());
    expect(balao).toHaveAttribute('data-aberto', 'true');
  });

  it('Esc também fecha o balão aberto só pelo mouse; sair e voltar o abre de novo', async () => {
    const { selo, balao } = montar();
    await userEvent.hover(selo);
    await userEvent.keyboard('{Escape}');
    expect(balao).toHaveAttribute('data-aberto', 'false');
    await userEvent.unhover(selo);
    await userEvent.hover(selo);
    expect(balao).toHaveAttribute('data-aberto', 'true');
  });

  it('continua aberto com o ponteiro sobre o próprio balão', async () => {
    const { selo, balao } = montar();
    await userEvent.hover(selo);
    await userEvent.unhover(selo);
    await userEvent.hover(balao);
    expect(balao).toHaveAttribute('data-aberto', 'true');
  });

  it('mantém o nome e a descrição acessíveis', () => {
    const { selo } = montar();
    expect(selo).toHaveAccessibleName('Local');
    expect(selo).toHaveAccessibleDescription('Seus PDFs não saem deste computador.');
  });
});
