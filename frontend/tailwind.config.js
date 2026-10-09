/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        eclipse: '#213555',
        denim: '#4F709C',
        honey: '#E5D283',
        'honey-claro': '#F6EFC9',
        'denim-claro': '#E4EBF3',
        papel: '#F3F5F8',
        tinta: '#16233A',
        suave: '#5B6B82',
        tijolo: '#A33A2E',
      },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
