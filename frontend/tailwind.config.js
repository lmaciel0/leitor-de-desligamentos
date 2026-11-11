/** @type {import('tailwindcss').Config} */

// Todas as cores vêm de variáveis CSS (definidas em src/index.css),
// com o canal alfa liberado para classes como border-linha/60.
const papel = (variavel) => `rgb(var(--${variavel}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: papel('fundo'),
        superficie: papel('superficie'),
        'superficie-alt': papel('superficie-alt'),
        linha: papel('linha'),
        texto: papel('texto'),
        forte: papel('forte'),
        suave: papel('suave'),
        apagado: papel('apagado'),
        coral: papel('coral'),
        'sobre-coral': papel('sobre-coral'),
        'coral-texto': papel('coral-texto'),
        'coral-claro': papel('coral-claro'),
        'coral-fundo': papel('coral-fundo'),
        destaque: papel('destaque'),
        'sobre-destaque': papel('sobre-destaque'),
        'ok-fundo': papel('ok-fundo'),
        anel: papel('anel'),
      },
      borderRadius: { cartao: '12px' },
      boxShadow: { cartao: '0 6px 20px rgb(20 33 61 / .08)' },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
