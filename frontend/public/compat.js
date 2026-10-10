// Confere, antes do app, se o navegador tem o mínimo que o Leitor usa.
// Se faltar algo, mostra um aviso no lugar da tela branca e impede o app de montar.
// Script clássico (sem módulos) de propósito: precisa rodar até em navegadores bem antigos.
(function () {
  var faltando = [];
  try {
    if (!('noModule' in HTMLScriptElement.prototype)) faltando.push('módulos JavaScript');
    if (typeof Worker !== 'function') faltando.push('Web Workers');
    if (!window.crypto || !window.crypto.subtle) faltando.push('criptografia do navegador');
    if (typeof Blob !== 'function' || typeof Blob.prototype.arrayBuffer !== 'function') faltando.push('leitura de arquivos');
  } catch (erro) {
    faltando.push('recursos básicos');
  }
  if (!faltando.length) return;

  window.__navegadorIncompativel = true;

  function mostrar() {
    var raiz = document.getElementById('root');
    if (!raiz) return;
    while (raiz.firstChild) raiz.removeChild(raiz.firstChild);

    var aviso = document.createElement('div');
    aviso.setAttribute('role', 'alert');
    aviso.setAttribute('style', 'max-width:40rem;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;line-height:1.5;border:2px solid #213555;border-radius:8px;background:#fff;color:#16233A');

    var titulo = document.createElement('p');
    titulo.setAttribute('style', 'font-weight:700;font-size:1.25rem;margin:0 0 .5rem');
    titulo.textContent = 'Este navegador é antigo demais para o Leitor de desligamentos.';

    var texto = document.createElement('p');
    texto.setAttribute('style', 'margin:0 0 .5rem');
    texto.textContent = 'Atualize o Google Chrome ou o Microsoft Edge (ou use outro navegador atualizado) e abra esta página de novo.';

    var detalhe = document.createElement('p');
    detalhe.setAttribute('style', 'margin:0;font-size:.875rem;color:#5B6B82');
    detalhe.textContent = 'Recursos que faltam: ' + faltando.join(', ') + '.';

    aviso.appendChild(titulo);
    aviso.appendChild(texto);
    aviso.appendChild(detalhe);
    raiz.appendChild(aviso);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrar);
  else mostrar();
})();
