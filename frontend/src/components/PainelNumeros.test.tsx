// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status } from '../tipos';
import { PainelNumeros } from './PainelNumeros';

interface Opcoes {
  total?: number;
  ok?: number;
  revisar?: number;
  conferidos?: number;
  totalRevisao?: number;
  statusAtivo?: Status | null;
  onAlternar?: (status: Status) => void;
}

function renderizar(opcoes: Opcoes = {}) {
  const { total = 24, ok = 18, revisar = 6, conferidos = 4, totalRevisao = 11, statusAtivo = null } = opcoes;
  return render(
    <PainelNumeros
      total={total}
      ok={ok}
      revisar={revisar}
      conferidos={conferidos}
      totalRevisao={totalRevisao}
      statusAtivo={statusAtivo}
      onAlternar={opcoes.onAlternar ?? (() => {})}
      lote={1}
    />,
  );
}

describe('PainelNumeros', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('prefers-reduced-motion') }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('agrupa a triagem com o nome "Triagem por status"', () => {
    renderizar();
    const grupo = screen.getByRole('group', { name: 'Triagem por status' });
    expect(within(grupo).getAllByRole('button')).toHaveLength(2);
  });

  it('mostra as contagens finais no nome acessível e marca o status ativo', () => {
    renderizar({ statusAtivo: 'REVISAR' });
    expect(screen.getByRole('button', { name: '18 OK' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '6 REVISAR' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mantém o nome acessível com os valores finais enquanto o número visível anima', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    renderizar();
    const botao = screen.getByRole('button', { name: '6 REVISAR' });
    expect(botao.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('clicar em OK ou REVISAR pede para alternar aquele status', async () => {
    const onAlternar = vi.fn();
    renderizar({ onAlternar });
    await userEvent.click(screen.getByRole('button', { name: '6 REVISAR' }));
    await userEvent.click(screen.getByRole('button', { name: '18 OK' }));
    expect(onAlternar).toHaveBeenNthCalledWith(1, 'REVISAR');
    expect(onAlternar).toHaveBeenNthCalledWith(2, 'OK');
  });

  it('não mostra o cartão de um status sem registros', () => {
    renderizar({ ok: 5, revisar: 0, total: 5 });
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 OK' })).toBeInTheDocument();
  });

  it('mantém o cartão do filtro ativo mesmo com zero registros, para o usuário poder desativá-lo', async () => {
    const onAlternar = vi.fn();
    renderizar({ ok: 5, revisar: 0, total: 5, statusAtivo: 'REVISAR', onAlternar });
    await userEvent.click(screen.getByRole('button', { name: '0 REVISAR' }));
    expect(onAlternar).toHaveBeenCalledWith('REVISAR');
  });

  it('mostra o total de arquivos lidos num cartão que não é botão', () => {
    renderizar({ total: 24 });
    expect(screen.getByText('arquivos lidos')).toBeInTheDocument();
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /arquivos lidos/ })).not.toBeInTheDocument();
  });

  it('o cartão de arquivos lidos expõe o total final a leitores de tela enquanto o número visível anima', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    renderizar({ total: 24 });
    const rotulo = screen.getByText('arquivos lidos');
    const cartao = rotulo.parentElement as HTMLElement;
    const animado = cartao.querySelector('[aria-hidden="true"]');
    expect(animado).not.toBeNull();
    expect(animado).toHaveTextContent('0');
    const leitor = cartao.querySelector('.sr-only');
    expect(leitor).toHaveTextContent('24');
  });

  it('mostra o progresso da revisão com role progressbar', () => {
    renderizar({ conferidos: 4, totalRevisao: 11 });
    expect(screen.getByText('4 de 11 conferidos')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Revisão' });
    expect(barra).toHaveAttribute('aria-valuenow', '4');
    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '11');
  });

  it('não mostra o cartão de revisão quando nada passou por revisão', () => {
    renderizar({ conferidos: 0, totalRevisao: 0 });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/conferidos/)).not.toBeInTheDocument();
  });

  it('esmaece o cartão inativo quando outro está ativo', () => {
    renderizar({ statusAtivo: 'REVISAR' });
    expect(screen.getByRole('button', { name: '18 OK' })).toHaveClass('opacity-60');
    expect(screen.getByRole('button', { name: '6 REVISAR' })).not.toHaveClass('opacity-60');
  });
});
