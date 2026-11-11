/** Etapa do fluxo mostrada na barra superior. 'exportado' marca as quatro como concluídas. */
export type Etapa = 'enviar' | 'processar' | 'revisar' | 'exportado';

export const ETAPAS: readonly { id: 'enviar' | 'processar' | 'revisar' | 'exportar'; rotulo: string }[] = [
  { id: 'enviar', rotulo: 'Enviar' },
  { id: 'processar', rotulo: 'Processar' },
  { id: 'revisar', rotulo: 'Revisar' },
  { id: 'exportar', rotulo: 'Exportar' },
];

/** Sem registros na tela, "exportado" não significa nada: os dados foram limpos e o fluxo recomeça. */
export function etapaAtual(estado: { arquivos: number; registros: number; carregando: boolean; exportado: boolean }): Etapa {
  if (estado.carregando) return 'processar';
  if (estado.registros > 0) return estado.exportado ? 'exportado' : 'revisar';
  return estado.arquivos > 0 ? 'processar' : 'enviar';
}
