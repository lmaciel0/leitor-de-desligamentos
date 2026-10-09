// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Filtros } from './Filtros';

const base = {
  municipios: ['CIDADE A', 'CIDADE B'],
  motivos: ['Mudança'],
  municipiosSelecionados: [] as string[],
  motivosSelecionados: [] as string[],
  onMunicipios: () => {},
  onMotivos: () => {},
};

const botao = (nome: RegExp) => screen.getByRole('button', { name: nome });

describe('Filtros', () => {
  it('marcar um município informa a nova seleção', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} onMunicipios={onMunicipios} />);
    await userEvent.click(botao(/^Município/));
    await userEvent.click(screen.getByLabelText('CIDADE B'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });

  it('desmarcar remove o item da seleção e o resumo mostra a quantidade', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} municipiosSelecionados={['CIDADE A', 'CIDADE B']} onMunicipios={onMunicipios} />);
    await userEvent.click(botao(/^Município \(2\)/));
    await userEvent.click(screen.getByLabelText('CIDADE A'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });

  it('informa se o menu está aberto (aria-expanded) e o abre e fecha pelo botão', async () => {
    render(<Filtros {...base} />);
    expect(botao(/^Município/)).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(botao(/^Município/));
    expect(botao(/^Município/)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Município' })).toBeInTheDocument();
    await userEvent.click(botao(/^Município/));
    expect(screen.queryByRole('group', { name: 'Município' })).not.toBeInTheDocument();
  });

  it('abrir um menu fecha o outro', async () => {
    render(<Filtros {...base} />);
    await userEvent.click(botao(/^Município/));
    await userEvent.click(botao(/^Motivo/));
    expect(screen.queryByRole('group', { name: 'Município' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Motivo' })).toBeInTheDocument();
  });

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    render(<Filtros {...base} />);
    await userEvent.click(botao(/^Município/));
    await userEvent.click(screen.getByLabelText('CIDADE A'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Município' })).not.toBeInTheDocument();
    expect(botao(/^Município/)).toHaveFocus();
  });

  it('clicar fora fecha o menu', async () => {
    render(<Filtros {...base} />);
    await userEvent.click(botao(/^Município/));
    await userEvent.click(document.body);
    expect(screen.queryByRole('group', { name: 'Município' })).not.toBeInTheDocument();
  });

  it('sair do menu com Tab fecha o menu', async () => {
    render(
      <>
        <Filtros {...base} />
        <button type="button">depois</button>
      </>,
    );
    await userEvent.click(botao(/^Motivo/));
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.queryByRole('group', { name: 'Motivo' })).not.toBeInTheDocument();
  });
});
