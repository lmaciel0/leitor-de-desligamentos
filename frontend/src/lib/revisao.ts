import type { DesligamentoRecord } from '../tipos';

/**
 * Registra quem precisou de revisão em algum momento do lote: quem está REVISAR fica marcado e a
 * marca não sai quando o registro vira OK. Devolve o mesmo registro quando nada muda.
 */
function marcarUm(registro: DesligamentoRecord): DesligamentoRecord {
  if (registro.revisarNoLote === true || registro.status !== 'REVISAR') return registro;
  return { ...registro, revisarNoLote: true };
}

export function marcarRevisao(registros: DesligamentoRecord[]): DesligamentoRecord[] {
  return registros.map(marcarUm);
}

/** Base de "X de Y conferidos": Y = quem passou por revisão no lote; X = desses, quem está OK agora. */
export function contarRevisao(registros: DesligamentoRecord[]): { conferidos: number; total: number } {
  const dosRevisados = registros.filter((registro) => registro.revisarNoLote === true);
  return { conferidos: dosRevisados.filter((registro) => registro.status === 'OK').length, total: dosRevisados.length };
}
