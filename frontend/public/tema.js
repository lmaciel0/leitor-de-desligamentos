// Aplica o tema antes de a página aparecer, para não piscar em claro no modo escuro.
// Mesma regra de src/lib/tema.ts: a escolha guardada vale mais que a preferência do sistema.
// É um arquivo próprio (e não um script no HTML) porque o CSP só permite scripts da própria origem.
(function () {
  try {
    var salvo = window.localStorage.getItem('tema');
    var escuro =
      salvo === 'escuro' ||
      (salvo !== 'claro' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (escuro) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (erro) {
    // Sem armazenamento ou sem matchMedia: fica no tema claro.
  }
})();
