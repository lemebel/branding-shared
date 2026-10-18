/**
 * Tema claro/escuro da plataforma Lemebel (núcleo compartilhado). Carregar no <head>, SÍNCRONO, antes do CSS do produto:
 *   <script src="https://cdn.jsdelivr.net/gh/lemebel/branding-shared@<SHA>/lemebel-theme.js"></script>
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lemebel/branding-shared@<SHA>/lemebel-theme.css">
 *
 * O que faz:
 *  - Preferência do usuário: 'auto' (padrão: segue o sistema do aparelho), 'light' ou 'dark'. Guardada em COOKIE
 *    `lem_theme` com Domain=.lemebel.com.br (vale em todos os produtos; não é segredo) + localStorage como reserva.
 *  - Aplica <html data-theme="light|dark"> + color-scheme ANTES da primeira pintura (sem "flash" claro).
 *  - Deriva --accent-text: a cor de MARCA do tenant usada como TEXTO/borda/link sobre a superfície, ajustada até 4,5:1
 *    (clareia no escuro, escurece no claro). --accent continua sendo o PREENCHIMENTO (botões, com --on-accent por cima).
 *    Os dois papéis do --accent não cabem num valor só no escuro — ver _docs/dark-mode/ESTUDO_MODO_ESCURO.md.
 *  - Evento `lemebel:theme` (detail: {pref, tema}) para gráficos/JS que leem variáveis CSS refazerem as cores.
 *  - Impressão sempre em claro (beforeprint/afterprint).
 *
 * API: LemebelTheme.get() -> {pref, tema}; .set('auto'|'light'|'dark'); .ciclo() -> próximo pref; .refresh() (recalcula --accent-text).
 * Falha silenciosa: nada aqui pode quebrar o app.
 */
(function (global) {
  'use strict';
  if (global.LemebelTheme) return;

  var COOKIE = 'lem_theme', LS = 'lem_theme', root = document.documentElement;
  var VALIDOS = { auto: 1, light: 1, dark: 1 };
  var pref = 'auto', ultimaChave = '', imprimindo = null;

  function lerCookie() {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function lerPref() {
    var v = lerCookie();
    if (!VALIDOS[v]) { try { v = localStorage.getItem(LS); } catch (e) { v = null; } }
    return VALIDOS[v] ? v : 'auto';
  }
  function gravarPref(v) {
    try {
      var dominio = /(^|\.)lemebel\.com\.br$/i.test(location.hostname) ? '; Domain=.lemebel.com.br' : '';
      var seguro = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = COOKIE + '=' + v + '; Path=/; Max-Age=31536000; SameSite=Lax' + dominio + seguro;
    } catch (e) { /* segue */ }
    try { localStorage.setItem(LS, v); } catch (e) { /* segue */ }
  }
  function sistemaEscuro() {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; }
  }
  function resolvido() { return imprimindo || (pref === 'dark' || (pref === 'auto' && sistemaEscuro()) ? 'dark' : 'light'); }

  /* ---------- contraste (WCAG) ---------- */
  function rgb(s) {
    s = String(s || '').trim();
    var m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = s.match(/^rgba?\(([^)]+)\)/i);
    if (m) { var p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2]]; }
    return null;
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function razao(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mistura(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] * (1 - t) + b[i] * t); }); }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join(''); }

  /* Cor de marca como TEXTO sobre `fundo`: mantém se já passa; senão caminha para branco (escuro) ou preto (claro) até 4,5:1. */
  function corDeTexto(accent, fundo, escuro) {
    if (razao(accent, fundo) >= 4.5) return hex(accent);
    var alvo = escuro ? [255, 255, 255] : [0, 0, 0];
    for (var t = 0.05; t <= 1.0001; t += 0.05) {
      var c = mistura(accent, alvo, t);
      if (razao(c, fundo) >= 4.5) return hex(c);
    }
    return hex(alvo);
  }
  function derivar() {
    try {
      var cs = getComputedStyle(root);
      var accent = rgb(cs.getPropertyValue('--accent')), surface = rgb(cs.getPropertyValue('--surface'));
      if (!accent || !surface) return;
      var escuro = root.getAttribute('data-theme') === 'dark';
      var chave = accent.join(',') + '|' + surface.join(',') + '|' + escuro;
      if (chave === ultimaChave) return;
      ultimaChave = chave;
      root.style.setProperty('--accent-text', corDeTexto(accent, surface, escuro));
      if (!cs.getPropertyValue('--on-accent').trim()) root.style.setProperty('--on-accent', razao([255, 255, 255], accent) >= 4.5 ? '#fff' : '#14110f');
    } catch (e) { /* segue */ }
  }

  function aplicar(avisar) {
    var tema = resolvido();
    root.setAttribute('data-theme', tema);
    root.setAttribute('data-theme-pref', pref);
    root.style.colorScheme = tema;
    ultimaChave = '';
    derivar();
    if (avisar) { try { document.dispatchEvent(new CustomEvent('lemebel:theme', { detail: { pref: pref, tema: tema } })); } catch (e) { /* segue */ } }
  }

  pref = lerPref();
  aplicar(false);

  // A cor da marca chega depois (tenant-branding-core grava --accent no style inline): recalcula quando mudar.
  try {
    new MutationObserver(function () { derivar(); }).observe(root, { attributes: true, attributeFilter: ['style'] });
  } catch (e) { /* segue */ }
  document.addEventListener('DOMContentLoaded', function () { ultimaChave = ''; derivar(); });
  global.addEventListener('load', function () { ultimaChave = ''; derivar(); });

  try {
    var mq = global.matchMedia('(prefers-color-scheme: dark)');
    var mudou = function () { if (pref === 'auto') aplicar(true); };
    if (mq.addEventListener) mq.addEventListener('change', mudou); else if (mq.addListener) mq.addListener(mudou);
  } catch (e) { /* segue */ }

  global.addEventListener('beforeprint', function () { imprimindo = 'light'; aplicar(false); });
  global.addEventListener('afterprint', function () { imprimindo = null; aplicar(false); });

  global.LemebelTheme = {
    get: function () { return { pref: pref, tema: resolvido() }; },
    set: function (v) { if (!VALIDOS[v]) return; pref = v; gravarPref(v); aplicar(true); },
    ciclo: function () { var n = pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto'; this.set(n); return n; },
    refresh: function () { ultimaChave = ''; derivar(); }
  };
})(window);
