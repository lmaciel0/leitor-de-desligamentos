// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardarImagem, limparImagens } from '../lib/ocr/imagens';
import type { DesligamentoRecord } from '../tipos';
import { TabelaResultados } from './TabelaResultados';
import codigoDoComponente from './TabelaResultados.tsx?raw';

function registro(parcial: Partial<DesligamentoRecord>): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '123',
    nib: '456',
    nome: 'ANA',
    motivo: 'Mudança',
    municipioConfere: false,
    validado: false,
    recebeCmic: false,
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const acoes = { onEditar: () => {}, onConferir: () => {}, onIniciarEdicao: () => {}, onEncerrarEdicao: () => {} };

describe('TabelaResultados', () => {
  beforeEach(() => limparImagens());

  it('editar uma célula informa id, campo e valor', async () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({ nome: '' })]} />);
    await userEvent.type(screen.getByLabelText('Nome de a.pdf'), 'B');
    expect(onEditar).toHaveBeenCalledWith(1, 'nome', 'B');
  });

  it('avisa o início e o fim da edição de uma célula', async () => {
    const onIniciarEdicao = vi.fn();
    const onEncerrarEdicao = vi.fn();
    render(<TabelaResultados {...acoes} onIniciarEdicao={onIniciarEdicao} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({})]} />);
    await userEvent.click(screen.getByLabelText('CPF de a.pdf'));
    expect(onIniciarEdicao).toHaveBeenCalledWith(1);
    await userEvent.click(document.body);
    expect(onEncerrarEdicao).toHaveBeenCalled();
  });

  it('só encerra a edição quando o foco sai da linha, não ao passar para outra célula da mesma linha', async () => {
    const onEncerrarEdicao = vi.fn();
    render(
      <TabelaResultados {...acoes} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({}), registro({ id: 2, arquivo: 'b.pdf' })]} />,
    );
    await userEvent.click(screen.getByLabelText('CPF de a.pdf'));
    await userEvent.tab();
    expect(screen.getByLabelText('NIS de a.pdf')).toHaveFocus();
    expect(onEncerrarEdicao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('CPF de b.pdf'));
    expect(onEncerrarEdicao).toHaveBeenCalledTimes(1);
  });

  it('linha REVISAR mostra as pendências ao expandir', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF', 'NIS'], cpf: '', nis: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    expect(screen.queryByRole('list', { name: 'Pendências de a.pdf' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /REVISAR/ }));
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('CPF');
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('NIS');
  });

  it('linha OK mostra "OK" sem botão de pendências', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
  });

  it('tem legenda e cabeçalhos de coluna para leitores de tela', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    expect(screen.getByRole('table', { name: 'Resultados do processamento' })).toBeInTheDocument();
    const cabecalhos = screen.getAllByRole('columnheader');
    expect(cabecalhos.length).toBeGreaterThan(0);
    expect(cabecalhos.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });

  it('o botão REVISAR aponta para a lista de pendências que ele abre', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF'], cpf: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    const botao = screen.getByRole('button', { name: /REVISAR/ });
    await userEvent.click(botao);
    const lista = screen.getByRole('list', { name: 'Pendências de a.pdf' });
    expect(lista.id).not.toBe('');
    expect(botao).toHaveAttribute('aria-controls', lista.id);
  });

  it('os cabeçalhos são Arquivo, Município, CPF, NIS, NIB, Nome, Motivo, Conferências e Status', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    const cabecalhos = screen.getAllByRole('columnheader');
    expect(cabecalhos.map((th) => th.textContent)).toEqual(['Arquivo', 'Município', 'CPF', 'NIS', 'NIB', 'Nome', 'Motivo', 'Conferências', 'Status']);
    expect(cabecalhos.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });

  it('mostra as três conferências numa coluna só, desmarcadas, com rótulo curto visível e nome acessível por linha', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    const linha = screen.getByLabelText('CPF de a.pdf').closest('tr') as HTMLElement;
    for (const [nome, curto] of [['Município confere', 'Município'], ['Está validado', 'Validado'], ['Recebe CMIC', 'CMIC']]) {
      expect(screen.getByRole('checkbox', { name: nome + ': a.pdf' })).not.toBeChecked();
      expect(within(linha).getByText(curto)).toBeInTheDocument();
    }
  });

  it('a data de referência aparece na célula do arquivo, com o rótulo só para leitor de tela', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    const celula = screen.getByText('a.pdf').closest('td') as HTMLElement;
    expect(celula).toHaveTextContent('09/10/2026');
    expect(within(celula).getByText(/Referência/)).toHaveClass('sr-only');
  });

  it('Nome e Motivo são campos de várias linhas; o wrapper guarda o valor em data-valor', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    for (const [campo, valor] of [['Nome', 'ANA'], ['Motivo', 'Mudança']]) {
      const area = screen.getByLabelText(`${campo} de a.pdf`);
      expect(area.tagName).toBe('TEXTAREA');
      expect(area.parentElement).toHaveAttribute('data-valor', valor);
    }
    expect(screen.getByLabelText('CPF de a.pdf').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Município de a.pdf').tagName).toBe('INPUT');
  });

  it('Enter no nome não cria quebra de linha', async () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({ nome: '' })]} />);
    await userEvent.type(screen.getByLabelText('Nome de a.pdf'), 'X{Enter}');
    expect(onEditar).toHaveBeenCalled();
    for (const [, , valor] of onEditar.mock.calls) expect(valor).not.toContain('\n');
  });

  it('quebra de linha colada vira espaço', () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({})]} />);
    fireEvent.change(screen.getByLabelText('Nome de a.pdf'), { target: { value: 'ANA\nSOUZA' } });
    expect(onEditar).toHaveBeenCalledWith(1, 'nome', 'ANA SOUZA');
  });

  it('a tabela não tem rolagem própria na vertical', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    const wrapper = screen.getByRole('table').parentElement as HTMLElement;
    expect(wrapper).not.toHaveClass('max-h-[70vh]');
  });

  it('marcar uma conferência informa id, campo e novo valor, e reflete o valor recebido', async () => {
    const onConferir = vi.fn();
    const { rerender } = render(<TabelaResultados {...acoes} onConferir={onConferir} registros={[registro({})]} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Está validado: a.pdf' }));
    expect(onConferir).toHaveBeenCalledWith(1, 'validado', true);
    rerender(<TabelaResultados {...acoes} onConferir={onConferir} registros={[registro({ validado: true })]} />);
    expect(screen.getByRole('checkbox', { name: 'Está validado: a.pdf' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Recebe CMIC: a.pdf' })).not.toBeChecked();
  });

  it('registro lido por OCR mostra a página original; registro sem a marca não mostra', () => {
    guardarImagem(1, 'data:image/jpeg;base64,AAAA');
    guardarImagem(2, 'data:image/jpeg;base64,BBBB');
    render(
      <TabelaResultados
        {...acoes}
        registros={[registro({ lidoPorOcr: true }), registro({ id: 2, arquivo: 'b.pdf' })]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Página do PDF a.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Página do PDF b.pdf' })).not.toBeInTheDocument();
  });

  it('registro de OCR em REVISAR abre as pendências dentro do painel, ao lado da página, sem linha nova', async () => {
    guardarImagem(1, 'data:image/jpeg;base64,AAAA');
    const revisar = registro({ lidoPorOcr: true, status: 'REVISAR', inconsistencias: ['CPF inválido', 'NIS vazio'] });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    const linhas = () => screen.getAllByRole('row').filter((linha) => linha.parentElement?.tagName === 'TBODY');
    expect(linhas()).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Pendências de a.pdf' })).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: /REVISAR/ });
    await userEvent.click(botao);
    const lista = screen.getByRole('list', { name: 'Pendências de a.pdf' });
    expect(lista.closest('tr')).toBe(screen.getByRole('img', { name: 'Página do PDF a.pdf' }).closest('tr'));
    expect(linhas()).toHaveLength(2);
    expect(botao).toHaveAttribute('aria-controls', lista.id);
  });

  it('registro sem OCR em REVISAR continua abrindo as pendências numa linha própria', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF inválido'] });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    await userEvent.click(screen.getByRole('button', { name: /REVISAR/ }));
    const linhas = screen.getAllByRole('row').filter((linha) => linha.parentElement?.tagName === 'TBODY');
    expect(linhas).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toBeInTheDocument();
  });

  it('registro de OCR sem imagem em memória mostra o aviso de indisponível', () => {
    render(<TabelaResultados {...acoes} registros={[registro({ lidoPorOcr: true })]} />);
    expect(screen.getByText(/Imagem da página não está disponível/)).toBeInTheDocument();
  });

  it('explica quando nenhum registro corresponde aos filtros', () => {
    render(<TabelaResultados {...acoes} registros={[]} />);
    expect(screen.getByText('Nenhum registro corresponde aos filtros.')).toBeInTheDocument();
  });

  it('etiqueta OK mostra o texto exato "OK" em formato de etiqueta', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    const etiqueta = screen.getByText('OK');
    expect(etiqueta).toHaveClass('bg-ok-fundo', 'rounded-full');
    expect(etiqueta).not.toHaveClass('animate-pulso-coral');
  });

  it('etiqueta Revisar mostra "Revisar · N", pulsa, e o botão mantém o nome acessível', () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF', 'NIS'], cpf: '', nis: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    const etiqueta = screen.getByText('Revisar · 2');
    expect(etiqueta).toHaveClass('animate-pulso-coral', 'bg-coral-claro', 'rounded-full');
    const botao = screen.getByRole('button', { name: 'REVISAR2 pendências' });
    expect(botao).toContainElement(etiqueta);
  });

  it('toda linha de registro entra com animate-entrar', () => {
    render(<TabelaResultados {...acoes} registros={[registro({}), registro({ id: 2, arquivo: 'b.pdf', status: 'REVISAR', inconsistencias: ['CPF'] })]} />);
    for (const arquivo of ['a.pdf', 'b.pdf']) {
      expect(screen.getByLabelText(`CPF de ${arquivo}`).closest('tr')).toHaveClass('animate-entrar');
    }
  });

  it('o movimento é só CSS: o componente não usa setInterval nem setTimeout', () => {
    expect(codigoDoComponente).not.toMatch(/setInterval|setTimeout/);
  });
});
