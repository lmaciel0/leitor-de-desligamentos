/** @type {import('tailwindcss').Config} */

// Cores que mudam entre os temas vêm de variáveis CSS (definidas em src/index.css),
// com o canal alfa liberado para classes como border-denim/30.
const papel = (variavel) => `rgb(var(--${variavel}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fixas nos dois temas
        eclipse: '#213555',
        honey: '#E5D283',
        'sobre-honey': '#213555',
        // Mudam com o tema
        papel: papel('fundo'),
        superficie: papel('superficie'),
        tinta: papel('texto'),
        forte: papel('texto-forte'),
        suave: papel('suave'),
        denim: papel('denim'),
        'denim-claro': papel('denim-claro'),
        'honey-claro': papel('honey-claro'),
        tijolo: papel('tijolo'),
        primario: papel('primario'),
        'primario-hover': papel('primario-hover'),
        'sobre-primario': papel('sobre-primario'),
        ok: papel('ok'),
        anel: papel('anel'),
        acento: papel('acento'),
      },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
