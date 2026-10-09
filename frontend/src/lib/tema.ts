export type Tema = 'claro' | 'escuro';

const CHAVE = 'tema';

/** A escolha guardada neste navegador, ou null se não houver (ou se o armazenamento estiver bloqueado). */
export function temaSalvo(): Tema | null {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return valor === 'claro' || valor === 'escuro' ? valor : null;
  } catch {
    return null;
  }
}

export function temaDoSistema(): Tema {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

/** A escolha guardada vale mais que a preferência do sistema. */
export function temaInicial(): Tema {
  return temaSalvo() ?? temaDoSistema();
}

export function salvarTema(tema: Tema): void {
  try {
    window.localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento, a escolha vale só nesta visita.
  }
}

/** Liga ou desliga a classe "dark" (que troca as cores) e avisa o navegador para adaptar controles nativos. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  raiz.classList.toggle('dark', tema === 'escuro');
  raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
}
