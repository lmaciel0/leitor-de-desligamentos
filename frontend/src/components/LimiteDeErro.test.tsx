// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LimiteDeErro } from './LimiteDeErro';

function Quebra(): never {
  throw new Error('falha na tela');
}

describe('LimiteDeErro', () => {
  beforeEach(() => {
    // O React registra o erro no console; aqui isso é esperado.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra o conteúdo normalmente quando nada quebra', () => {
    render(
      <LimiteDeErro>
        <p>tudo certo</p>
      </LimiteDeErro>,
    );
    expect(screen.getByText('tudo certo')).toBeInTheDocument();
  });

  it('troca a tela branca por um aviso que explica o que fazer', () => {
    render(
      <LimiteDeErro>
        <Quebra />
      </LimiteDeErro>,
    );
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('Algo deu errado na tela.');
    expect(aviso).toHaveTextContent('Nenhum dado saiu deste computador.');
    expect(aviso).toHaveTextContent('Abrir trabalho');
  });

  it('o botão recarrega a página', async () => {
    const onRecarregar = vi.fn();
    render(
      <LimiteDeErro onRecarregar={onRecarregar}>
        <Quebra />
      </LimiteDeErro>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar a página' }));
    expect(onRecarregar).toHaveBeenCalledTimes(1);
  });
});
