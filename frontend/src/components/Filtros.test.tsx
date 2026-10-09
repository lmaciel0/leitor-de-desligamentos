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

describe('Filtros', () => {
  it('marcar um município informa a nova seleção', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} onMunicipios={onMunicipios} />);
    await userEvent.click(screen.getByText('Município'));
    await userEvent.click(screen.getByLabelText('CIDADE B'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });

  it('desmarcar remove o item da seleção e o resumo mostra a quantidade', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} municipiosSelecionados={['CIDADE A', 'CIDADE B']} onMunicipios={onMunicipios} />);
    expect(screen.getByText('Município (2)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Município (2)'));
    await userEvent.click(screen.getByLabelText('CIDADE A'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });
});
