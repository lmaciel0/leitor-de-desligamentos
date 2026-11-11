// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { guardarImagem, limparImagens } from '../lib/ocr/imagens';
import { ImagemDaPagina } from './ImagemDaPagina';

describe('ImagemDaPagina', () => {
  beforeEach(() => limparImagens());

  it('mostra a imagem guardada com o texto alternativo do arquivo', () => {
    guardarImagem(7, 'data:image/jpeg;base64,AAAA');
    render(<ImagemDaPagina idDoRegistro={7} arquivo="a.pdf" />);
    const imagem = screen.getByRole('img', { name: 'Página do PDF a.pdf' });
    expect(imagem).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
  });

  it('o botão alterna entre Ampliar e Reduzir e acompanha com aria-pressed', async () => {
    guardarImagem(7, 'data:image/jpeg;base64,AAAA');
    render(<ImagemDaPagina idDoRegistro={7} arquivo="a.pdf" />);
    const ampliar = screen.getByRole('button', { name: 'Ampliar' });
    expect(ampliar).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(ampliar);
    const reduzir = screen.getByRole('button', { name: 'Reduzir' });
    expect(reduzir).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(reduzir);
    expect(screen.getByRole('button', { name: 'Ampliar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sem imagem em memória, avisa que não está disponível e não mostra img', () => {
    render(<ImagemDaPagina idDoRegistro={9} arquivo="a.pdf" />);
    expect(screen.getByText('Imagem da página não está disponível. Carregue o PDF de novo para conferir.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ampliar|Reduzir/ })).not.toBeInTheDocument();
  });
});
