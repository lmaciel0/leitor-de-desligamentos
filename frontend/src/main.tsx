import './lib/polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import App from './App';
import './index.css';

// public/compat.js marca a página quando o navegador não tem o mínimo; aí o aviso dele fica na tela.
if (!(window as Window & { __navegadorIncompativel?: boolean }).__navegadorIncompativel) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
