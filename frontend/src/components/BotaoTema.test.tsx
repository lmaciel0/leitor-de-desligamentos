// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BotaoTema } from './BotaoTema';

describe('BotaoTema', () => {
  it('é um botão de alternância chamado "Modo escuro", desligado no tema claro', () => {
    render(<BotaoTema escuro={false} onAlternar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Modo escuro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fica pressionado no tema escuro, sem mudar o nome', () => {
    render(<BotaoTema escuro onAlternar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Modo escuro' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pede para alternar ao clicar e ao usar o teclado', async () => {
    const onAlternar = vi.fn();
    render(<BotaoTema escuro={false} onAlternar={onAlternar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Modo escuro' }));
    screen.getByRole('button', { name: 'Modo escuro' }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onAlternar).toHaveBeenCalledTimes(3);
  });
});
