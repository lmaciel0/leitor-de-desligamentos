// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaAmpliada } from './PaginaAmpliada';

const IMAGEM = 'data:image/jpeg;base64,AAAA';

function abrir(onFechar = vi.fn()) {
  const resultado = render(<PaginaAmpliada imagem={IMAGEM} arquivo="a.pdf" onFechar={onFechar} />);
  return { ...resultado, onFechar };
}

describe('PaginaAmpliada', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('abre em document.body como diálogo modal, com o foco em Fechar', () => {
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Página do PDF a.pdf, em tela cheia' });
    expect(dialogo.parentElement).toBe(document.body);
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('a imagem não usa o nome que o e2e procura na página', () => {
    abrir();
    const imagem = screen.getByRole('img', { name: 'Página ampliada do PDF a.pdf' });
    expect(imagem).toHaveAttribute('src', IMAGEM);
    expect(screen.queryByRole('img', { name: 'Página do PDF a.pdf' })).not.toBeInTheDocument();
  });

  it('Escape chama onFechar uma vez', async () => {
    const { onFechar } = abrir();
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar em Fechar chama onFechar uma vez', async () => {
    const { onFechar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('prende o foco: Tab no último volta ao primeiro e Shift+Tab no primeiro vai ao último', async () => {
    abrir();
    const alternador = screen.getByRole('button', { name: 'Tamanho real' });
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(fechar).toHaveFocus();
    await userEvent.tab();
    expect(alternador).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(fechar).toHaveFocus();
  });

  it('o alternador começa em Tamanho real (pressed=false) e passa a Caber na tela (pressed=true)', async () => {
    abrir();
    const alternador = screen.getByRole('button', { name: 'Tamanho real' });
    expect(alternador).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(alternador);
    expect(screen.getByRole('button', { name: 'Caber na tela' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('trava a rolagem da página enquanto montado e devolve o valor anterior ao desmontar', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = abrir();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
