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

  it('Ampliar abre a página em tela cheia; Escape fecha e devolve o foco ao botão', async () => {
    guardarImagem(7, 'data:image/jpeg;base64,AAAA');
    render(<ImagemDaPagina idDoRegistro={7} arquivo="a.pdf" />);
    const ampliar = screen.getByRole('button', { name: 'Ampliar' });
    expect(ampliar).toHaveAttribute('aria-haspopup', 'dialog');
    expect(ampliar).not.toHaveAttribute('aria-pressed');
    await userEvent.click(ampliar);
    expect(screen.getByRole('dialog', { name: 'Página do PDF a.pdf, em tela cheia' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ampliar' })).toHaveFocus();
  });

  it('mostra o que vem como filhos na coluna do botão', () => {
    guardarImagem(7, 'data:image/jpeg;base64,AAAA');
    render(
      <ImagemDaPagina idDoRegistro={7} arquivo="a.pdf">
        <p>filho</p>
      </ImagemDaPagina>,
    );
    expect(screen.getByText('filho')).toBeInTheDocument();
  });

  it('sem imagem em memória, avisa que não está disponível e não mostra img', () => {
    render(<ImagemDaPagina idDoRegistro={9} arquivo="a.pdf" />);
    expect(screen.getByText('Imagem da página não está disponível. Carregue o PDF de novo para conferir.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ampliar|Reduzir/ })).not.toBeInTheDocument();
  });
});
