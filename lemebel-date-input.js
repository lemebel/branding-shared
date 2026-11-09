/*
 * lemebel-date-input.js — campos de data/hora nativos sem "pulo" durante a digitação.
 *
 * Problema: <input type="date"|"datetime-local"|"month"|"time"> dispara `input` e `change` a CADA
 * segmento editado que forma uma data válida (cada dígito do ano, por exemplo). Quase todo handler
 * do produto reage a isso refazendo a tela ou recalculando campos; o input é recriado no meio da
 * edição e o foco/cursor vai embora ("joga pro final da data").
 *
 * Solução (sem tocar nos handlers dos produtos): enquanto a pessoa está DIGITANDO no teclado, os
 * eventos `input`/`change` do campo ficam retidos e são entregues uma única vez ao terminar:
 * ao sair do campo (blur) ou ao apertar Enter. Escolha no calendário (clique/toque) segue
 * imediata, pois não há edição em andamento.
 *
 * Uso: <script src=".../lemebel-date-input.js"></script> no <head>, antes dos scripts do produto.
 * Idempotente. Não depende de nada.
 */
(function () {
  if (window.__lemebelDateInput) return;
  window.__lemebelDateInput = true;

  var TIPOS = { 'date': 1, 'datetime-local': 1, 'month': 1, 'time': 1, 'week': 1 };
  function ehData(el) {
    return !!(el && el.tagName === 'INPUT' && TIPOS[el.type]);
  }
  function teclaEdita(k) {
    return /^[0-9]$/.test(k) || k === 'Backspace' || k === 'Delete' || k === 'ArrowUp' || k === 'ArrowDown';
  }

  // Marca "digitando" só por tecla de edição; clique/toque (calendário) desmarca.
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!ehData(t)) return;
    if (e.key === 'Enter') { liberar(t); return; } // Tab não: ele só troca de segmento (dia/mês/ano)
    if (teclaEdita(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) t.__ldiDigitando = true;
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (ehData(e.target)) liberar(e.target);
  }, true);

  function reter(e) {
    var t = e.target;
    if (!ehData(t) || t.__ldiLiberando || !t.__ldiDigitando) return;
    e.stopImmediatePropagation();
    t.__ldiPendente = true;
  }
  document.addEventListener('input', reter, true);
  document.addEventListener('change', reter, true);

  // Entrega os eventos retidos (uma vez).
  function liberar(t) {
    if (!t.__ldiPendente) { t.__ldiDigitando = false; return; }
    t.__ldiPendente = false;
    t.__ldiDigitando = false;
    t.__ldiLiberando = true;
    try {
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      t.__ldiLiberando = false;
    }
  }
  document.addEventListener('focusout', function (e) {
    if (ehData(e.target)) liberar(e.target);
  }, true);
})();
