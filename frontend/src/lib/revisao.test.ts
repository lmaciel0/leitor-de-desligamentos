import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../tipos';
import { contarRevisao, marcarRevisao } from './revisao';

function registro(id: number, parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id,
    arquivo: `${id}.pdf`,
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '12345678919',
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

const revisar = (id: number, parcial: Partial<DesligamentoRecord> = {}) =>
  registro(id, { nome: '', status: 'REVISAR', inconsistencias: ['NOME'], ...parcial });

describe('marcarRevisao', () => {
  it('marca true quem está em REVISAR', () => {
    expect(marcarRevisao([revisar(1)])[0].revisarNoLote).toBe(true);
  });

  it('mantém true em quem já foi REVISAR e virou OK', () => {
    expect(marcarRevisao([registro(1, { revisarNoLote: true })])[0].revisarNoLote).toBe(true);
  });

  it('deixa ausente ou false quem é OK e nunca foi REVISAR', () => {
    const [ausente, falso] = marcarRevisao([registro(1), registro(2, { revisarNoLote: false })]);
    expect(ausente.revisarNoLote).toBeFalsy();
    expect(falso.revisarNoLote).toBeFalsy();
  });

  it('devolve o mesmo objeto quando nada muda', () => {
    const ok = registro(1);
    const jaMarcado = revisar(2, { revisarNoLote: true });
    const resultado = marcarRevisao([ok, jaMarcado]);
    expect(resultado[0]).toBe(ok);
    expect(resultado[1]).toBe(jaMarcado);
  });
});

describe('contarRevisao', () => {
  it('conta os que passaram por revisão e quantos deles estão OK', () => {
    const okQueFoiRevisar = registro(3, { revisarNoLote: true });
    expect(contarRevisao([registro(1), revisar(2, { revisarNoLote: true }), okQueFoiRevisar])).toEqual({ conferidos: 1, total: 2 });
  });

  it('lista vazia dá zero e zero', () => {
    expect(contarRevisao([])).toEqual({ conferidos: 0, total: 0 });
  });
});
