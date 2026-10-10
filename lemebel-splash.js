/**
 * Tela de abertura compartilhada (boot-cover) — mesmo split do login (45% marca / 55% claro).
 * Fonte unica para Gestao, Qualidade, Consultoria e Painel. Self-service: cor, logo e nome vem da
 * marca do tenant (window.EMPRESA, ja pintada por tenant-branding antes deste script).
 *
 * Uso: <div id="boot-cover" data-produto="Gestão"></div>
 *      <script src=".../lemebel-splash.js"></script>   (logo depois do div; precisa de lemebel-marca-core.js antes)
 *   data-lemebel="1" -> painel da plataforma: usa a marca Lemebel no lugar da logo de tenant.
 * Reexibir depois do load: window.LemebelSplash.mostrar({ produto: 'Painel', lemebel: true }).
 * O CSS (#boot-cover) vem de lemebel-tokens.css. Quem esconde a tela e o app (esconderBootCover).
 */
(function () {
  'use strict';
  function montar(c) {
  try { clearTimeout(window._bcT1); clearInterval(window._bcT2); clearTimeout(window._bcT3); } catch (e) {}
  var M = window.LemebelMarca;
  var E = window.EMPRESA || {};
  var produto = (c.getAttribute('data-produto') || '').toUpperCase().replace(/[<>&]/g, '');
  var lemebel = c.getAttribute('data-lemebel') === '1';

  var logo = lemebel && M
    ? '<span class="bc-logo bc-svg" style="display:block">' + M.marca({ px: 200 }) + '</span>'
    : '<img class="bc-logo" id="bc-logo" alt="">';
  var simbolo = M ? M.icone({ px: 32 }) : '';
  c.setAttribute('role', 'status');
  c.setAttribute('aria-live', 'polite');
  c.innerHTML =
    '<div class="bc-l">' + logo + '<div class="bc-nome" id="bc-nome"></div></div>' +
    '<div class="bc-r"><div class="bc-bar" aria-hidden="true"><i></i></div>' +
    '<div class="bc-msg" id="bc-msg"></div>' +
    '<button class="bc-reload" id="bc-reload" type="button" onclick="location.reload()">Recarregar</button></div>' +
    '<div class="bc-foot">' + simbolo + '<span class="lsb-wm">LEMEBEL' +
    (produto ? '<span class="lsb-product">' + produto + '</span>' : '') + '</span></div>';

  var m = document.getElementById('bc-msg'), r = document.getElementById('bc-reload');
  try {
    var lg = document.getElementById('bc-logo'), nm = document.getElementById('bc-nome');
    if (!lemebel) {
      if (E.nome && nm) nm.textContent = E.nome;
      if (E.logo && lg) {
        lg.onload = function () { lg.style.display = 'block'; if (nm) nm.style.display = 'none'; };
        lg.onerror = function () { lg.style.display = 'none'; if (nm && E.nome) nm.style.display = 'block'; };
        lg.src = E.logo;
      } else if (nm && E.nome) { nm.style.display = 'block'; }
    }
  } catch (e) {}

  // Mensagens rotativas com fade. Nomes _bcT1/_bcT2/_bcT3 mantidos: esconderBootCover() dos apps os limpa.
  var fr = ['Preparando o seu espaço…', 'Carregando os seus dados…', 'Organizando tudo…', 'Quase lá…'], k = 0;
  window._bcT1 = setTimeout(function () {
    if (!m.isConnected) return;
    var passo = function () {
      if (!m.isConnected) { clearInterval(window._bcT2); return; }
      m.classList.remove('on');
      setTimeout(function () {
        if (!m.isConnected) return;
        m.textContent = fr[Math.min(k, fr.length - 1)]; k++; m.classList.add('on');
      }, 320);
    };
    m.textContent = fr[0]; k = 1; m.classList.add('on');
    window._bcT2 = setInterval(passo, 3200);
  }, 2500);
  window._bcT3 = setTimeout(function () {
    if (!m.isConnected) return;
    clearInterval(window._bcT2); m.classList.add('on');
    m.textContent = 'Está demorando mais que o normal. Você pode aguardar mais um pouco ou recarregar a página.';
    r.style.display = 'inline-block';
  }, 40000);
  }

  var c0 = document.getElementById('boot-cover');
  if (c0) montar(c0);

  // Reexibe a abertura depois do load (ex.: painel, enquanto busca os dados logo após o login).
  // Se já houver um #boot-cover na tela, não faz nada. Quem esconde é o app (esconderBootCover).
  window.LemebelSplash = {
    mostrar: function (opts) {
      if (document.getElementById('boot-cover')) return;
      var c = document.createElement('div');
      c.id = 'boot-cover';
      if (opts && opts.produto) c.setAttribute('data-produto', opts.produto);
      if (opts && opts.lemebel) c.setAttribute('data-lemebel', '1');
      document.body.appendChild(c);
      montar(c);
    }
  };
})();
