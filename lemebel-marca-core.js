/**
 * Nucleo compartilhado do simbolo Lemebel (circulo + canal em L + gota).
 * Fonte de verdade unica das coordenadas do path — nenhum produto deve
 * colar o path SVG localmente. Cor e o unico parametro que varia por
 * vertente/tenant (ver CLAUDE.md item 7/8).
 *
 * Uso tipico:
 *   <script src="https://cdn.jsdelivr.net/gh/lemebel/branding-shared@main/lemebel-marca-core.js"></script>
 *   document.getElementById('alvo').innerHTML = window.LemebelMarca.icone({px:28});
 */
(function (global) {
  'use strict';

  var CIRCULO = 'M40 128 C40 79.6 79.6 40 128 40 C176.4 40 216 79.6 216 128 C216 176.4 176.4 216 128 216 C79.6 216 40 176.4 40 128 Z';
  var CANAL_L = 'M85 73 L113 73 L113 155 L171 155 L171 183 L85 183 Z';
  var GOTA = 'M139 71 C155 89 157 105 139 115 C125 121 121 107 124 97 C127 87 133 79 139 71 Z';
  var MARCA = CANAL_L + ' ' + GOTA;
  var COMPLETO = CIRCULO + ' ' + MARCA;

  // Icone flat de 1 cor so (fill-rule evenodd: L/gota viram vazado dentro do circulo).
  // Uso: sidebar/nav/badges pequenos onde o icone herda currentColor do texto.
  function icone(opts) {
    opts = opts || {};
    var px = opts.px || 48;
    var extra = opts.attrs ? ' ' + opts.attrs : '';
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" style="display:block"' + extra + '><path fill-rule="evenodd" d="' + COMPLETO + '"/></svg>';
  }

  // Icone de 2 cores (circulo na cor da vertente/tenant, L+gota brancos por cima).
  // Uso: icone de app, favicon, selos, cartoes de identidade.
  function icone2Cores(opts) {
    opts = opts || {};
    var px = opts.px || 48;
    var corFundo = opts.corFundo || 'currentColor';
    var corMarca = opts.corMarca || '#FFFFFF';
    var extra = opts.attrs ? ' ' + opts.attrs : '';
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 256 256" aria-hidden="true" style="display:block"' + extra + '>' +
      '<path d="' + CIRCULO + '" fill="' + corFundo + '"/>' +
      '<path fill-rule="evenodd" d="' + MARCA + '" fill="' + corMarca + '"/>' +
      '</svg>';
  }

  // So o L+gota, sem circulo — para quando o fundo colorido ja vem de outro
  // elemento (ex.: o banner .brand da tela de login, ver CLAUDE.md item 6).
  function marca(opts) {
    opts = opts || {};
    var px = opts.px || 220;
    var cor = opts.cor || '#FFFFFF';
    var id = opts.id ? ' id="' + opts.id + '"' : '';
    var extra = opts.attrs ? ' ' + opts.attrs : '';
    return '<svg' + id + ' width="' + px + '" height="' + px + '" viewBox="0 0 256 256" fill="' + cor + '" aria-hidden="true" style="width:' + px + 'px;max-width:78%;height:auto;display:block;margin:0 auto"' + extra + '><path fill-rule="evenodd" d="' + MARCA + '"/></svg>';
  }

  // data:URI para <link rel="icon"> — corFundo/corMarca em hex, sem '#'.
  function faviconDataUri(corFundoHex, corMarcaHex) {
    corFundoHex = corFundoHex || '9D4321';
    corMarcaHex = corMarcaHex || 'FFFFFF';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">' +
      '<path d="' + CIRCULO + '" fill="%23' + corFundoHex + '"/>' +
      '<path fill-rule="evenodd" d="' + MARCA + '" fill="%23' + corMarcaHex + '"/>' +
      '</svg>';
    return 'data:image/svg+xml,' + svg.replace(/#/g, '%23').replace(/"/g, "'");
  }

  global.LemebelMarca = {
    CIRCULO: CIRCULO,
    CANAL_L: CANAL_L,
    GOTA: GOTA,
    icone: icone,
    icone2Cores: icone2Cores,
    marca: marca,
    faviconDataUri: faviconDataUri
  };
})(window);
