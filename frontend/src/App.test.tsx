// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from './tipos';

vi.mock('./lib/processar', () => ({ processarLote: vi.fn() }));

import App from './App';
import { processarLote } from './lib/processar';

function registro(id: number, parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id,
    arquivo: `${id}.pdf`,
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '123',
    nib: '456',
    nome: 'ANA',
    motivo: 'Mudança',
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const revisar = (id: number) =>
  registro(id, { nome: '', status: 'REVISAR', inconsistencias: ['NOME'] });

async function enviarEProcessar(...nomes: string[]) {
  const arquivos = nomes.map((nome) => new File(['x'], nome, { type: 'application/pdf' }));
  await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), arquivos);
  await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(processarLote).mockReset();
  });

  it('processa os arquivos e mostra a triagem e a tabela', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    expect(await screen.findByRole('button', { name: /1 OK/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 REVISAR/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome de 2.pdf')).toBeInTheDocument();
  });

  it('exige ao menos um PDF para processar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
    expect(screen.getByText('Selecione ao menos um PDF.')).toBeInTheDocument();
    expect(processarLote).not.toHaveBeenCalled();
  });

  it('clicar em REVISAR na triagem filtra e clicar de novo remove o filtro', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.click(await screen.findByRole('button', { name: /1 REVISAR/ }));
    expect(screen.queryByLabelText('Nome de 1.pdf')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome de 2.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /1 REVISAR/ }));
    expect(screen.getByLabelText('Nome de 1.pdf')).toBeInTheDocument();
  });

  it('editar uma célula recalcula o status', async () => {
    vi.mocked(processarLote).mockResolvedValue([revisar(1)]);
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.type(await screen.findByLabelText('Nome de 1.pdf'), 'B');
    expect(await screen.findByRole('button', { name: /1 OK/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\d+ REVISAR/ })).not.toBeInTheDocument();
  });

  it('com o filtro REVISAR ativo, a linha editada continua visível até sair da célula', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.click(await screen.findByRole('button', { name: /1 REVISAR/ }));
    const campo = screen.getByLabelText('Nome de 2.pdf');
    await userEvent.type(campo, 'B');
    expect(screen.getByLabelText('Nome de 2.pdf')).toHaveValue('B');
    // Tab só leva o foco à próxima célula da mesma linha; clicar fora encerra a edição.
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByLabelText('Nome de 2.pdf')).not.toBeInTheDocument());
  });

  it('ignora PDF repetido (mesmo conteúdo, nome diferente) e avisa', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), [
      new File(['mesmo'], 'a.pdf', { type: 'application/pdf' }),
      new File(['mesmo'], 'a (1).pdf', { type: 'application/pdf' }),
      new File(['outro'], 'b.pdf', { type: 'application/pdf' }),
    ]);
    expect(await screen.findByText('1 arquivo repetido ignorado: a (1).pdf.')).toBeInTheDocument();
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.queryByText('a (1).pdf')).not.toBeInTheDocument();
  });

  it('arquivo que não é PDF, solto na zona de upload, é ignorado com aviso', async () => {
    render(<App />);
    fireEvent.drop(screen.getByTestId('zona-upload'), {
      dataTransfer: {
        files: [new File(['x'], 'nota.txt', { type: 'text/plain' }), new File(['y'], 'ok.pdf', { type: 'application/pdf' })],
      },
    });
    expect(await screen.findByText('1 arquivo ignorado por não ser PDF: nota.txt.')).toBeInTheDocument();
    expect(screen.getByText('ok.pdf')).toBeInTheDocument();
  });

  it('processar de novo com resultados pede confirmação, e cancelar não reprocessa', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1)]);
    render(<App />);
    await enviarEProcessar('1.pdf');
    await screen.findByRole('button', { name: /1 OK/ });
    await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
    expect(screen.getByRole('alertdialog', { name: 'Processar de novo?' })).toBeInTheDocument();
    expect(processarLote).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(processarLote).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Processar arquivos/ })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Processar de novo' }));
    await waitFor(() => expect(processarLote).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('o aviso de reprocessar conta as linhas que o usuário editou', async () => {
    vi.mocked(processarLote).mockResolvedValue([revisar(1), registro(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.type(await screen.findByLabelText('Nome de 1.pdf'), 'B');
    await userEvent.click(document.body);
    await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/descarta as suas edições em 1 linha./);
  });

  it('anuncia o resultado do processamento para leitores de tela', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    expect(await screen.findByText('2 arquivos processados: 1 OK, 1 REVISAR.')).toBeInTheDocument();
  });

  it('Limpar dados zera tudo e descarta o resultado de um lote em andamento', async () => {
    let concluir: (registros: DesligamentoRecord[]) => void = () => {};
    vi.mocked(processarLote).mockImplementation(
      () => new Promise<DesligamentoRecord[]>((resolver) => { concluir = resolver; }),
    );
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar dados' }));
    concluir([registro(1)]);
    await waitFor(() => expect(screen.queryByLabelText('Nome de 1.pdf')).not.toBeInTheDocument());
    expect(within(document.body).queryByText('1.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Processar arquivos/ })).toBeEnabled();
  });

  it('um CPF digitado com pontuação é normalizado e o registro fica OK', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1, { cpf: '', status: 'REVISAR', inconsistencias: ['CPF'] })]);
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.type(await screen.findByLabelText('CPF de 1.pdf'), '123.456.789-09');
    expect(screen.getByLabelText('CPF de 1.pdf')).toHaveValue('12345678909');
    expect(await screen.findByRole('button', { name: /1 OK/ })).toBeInTheDocument();
  });

  it('um CPF de 11 caracteres com hífen não vira OK', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1, { cpf: '', status: 'REVISAR', inconsistencias: ['CPF'] })]);
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.type(await screen.findByLabelText('CPF de 1.pdf'), '123456789-0');
    expect(screen.getByLabelText('CPF de 1.pdf')).toHaveValue('1234567890');
    expect(await screen.findByRole('button', { name: /1 REVISAR/ })).toBeInTheDocument();
  });

  it('a opção selecionada de um filtro continua listada depois que a edição a elimina', async () => {
    vi.mocked(processarLote).mockResolvedValue([
      registro(1, { municipio: 'CIDADE X' }),
      registro(2, { municipio: 'CIDADE A' }),
    ]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.click(await screen.findByRole('button', { name: /^Município/ }));
    await userEvent.click(screen.getByLabelText('CIDADE X'));
    const campo = screen.getByLabelText('Município de 1.pdf');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'CIDADE Y');
    await userEvent.click(document.body);
    expect(screen.queryByLabelText('Município de 1.pdf')).not.toBeInTheDocument();
    // Clicar na tabela fechou o menu; reabre para conferir que a opção continua listada.
    await userEvent.click(screen.getByRole('button', { name: 'Município (1)' }));
    expect(screen.getByLabelText('CIDADE X')).toBeChecked();
    await userEvent.click(screen.getByLabelText('CIDADE X'));
    expect(screen.getByLabelText('Município de 1.pdf')).toBeInTheDocument();
  });
});
