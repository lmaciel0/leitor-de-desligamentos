// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraEtapas } from './BarraEtapas';

function itens() {
  return within(screen.getByRole('navigation', { name: 'Etapas' })).getAllByRole('listitem');
}

describe('BarraEtapas', () => {
  it('é uma navegação "Etapas" com lista ordenada de 4 itens, na ordem', () => {
    render(<BarraEtapas etapa="enviar" processando={false} />);
    const nav = screen.getByRole('navigation', { name: 'Etapas' });
    expect(within(nav).getByRole('list').tagName).toBe('OL');
    expect(itens().map((item) => item.textContent)).toEqual([
      expect.stringContaining('Enviar'),
      expect.stringContaining('Processar'),
      expect.stringContaining('Revisar'),
      expect.stringContaining('Exportar'),
    ]);
  });

  it('em Revisar: só ela é a etapa atual e as anteriores aparecem como concluídas', () => {
    render(<BarraEtapas etapa="revisar" processando={false} />);
    const [enviar, processar, revisar, exportar] = itens();
    expect(revisar).toHaveAttribute('aria-current', 'step');
    expect(enviar).not.toHaveAttribute('aria-current');
    expect(processar).not.toHaveAttribute('aria-current');
    expect(exportar).not.toHaveAttribute('aria-current');
    expect(within(enviar).getByText('concluída')).toBeInTheDocument();
    expect(within(processar).getByText('concluída')).toBeInTheDocument();
    expect(within(revisar).queryByText('concluída')).not.toBeInTheDocument();
    expect(within(exportar).queryByText('concluída')).not.toBeInTheDocument();
  });

  it('exportado: as quatro concluídas e nenhuma atual', () => {
    render(<BarraEtapas etapa="exportado" processando={false} />);
    for (const item of itens()) {
      expect(item).not.toHaveAttribute('aria-current');
      expect(within(item).getByText('concluída')).toBeInTheDocument();
    }
  });

  it('traz o texto curto para telas pequenas', () => {
    const { rerender } = render(<BarraEtapas etapa="revisar" processando={false} />);
    expect(screen.getByText('Etapa 3 de 4 · Revisar')).toBeInTheDocument();
    rerender(<BarraEtapas etapa="exportado" processando={false} />);
    expect(screen.getByText('Etapa 4 de 4 · Exportado')).toBeInTheDocument();
  });

  it('processando: a bolinha da etapa atual gira', () => {
    const { rerender } = render(<BarraEtapas etapa="processar" processando />);
    const atual = itens()[1];
    expect(atual).toHaveAttribute('aria-current', 'step');
    expect(atual.querySelector('.animate-spin')).not.toBeNull();
    rerender(<BarraEtapas etapa="processar" processando={false} />);
    expect(itens()[1].querySelector('.animate-spin')).toBeNull();
  });
});
