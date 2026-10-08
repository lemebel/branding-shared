/**
 * Avisos da plataforma Lemebel DENTRO dos apps (Gestão, Consultoria, Qualidade).
 * Núcleo compartilhado: a regra de exibição existe uma vez só; cada app só informa COMO buscar
 * e dispensar (cada um tem seu helper de autenticação/URL do erp-api).
 *
 * Uso (depois do login):
 *   <script src="https://cdn.jsdelivr.net/gh/lemebel/branding-shared@<SHA-DO-COMMIT>/lemebel-avisos.js"></script>
 *   LemebelAvisos.iniciar({
 *     listar:    () => Promise<Array<{id,titulo,corpo,severidade}>>,   // GET /v1/avisos
 *     dispensar: (id) => Promise<any>,                                  // POST /v1/avisos/:id/dispensar
 *   });
 *   // no logout:  LemebelAvisos.parar();
 *
 * Segurança: título e mensagem são texto livre escrito no painel -> SEMPRE textContent, nunca HTML.
 * Falha silenciosa: qualquer erro aqui nunca pode atrapalhar o app. Não rouba foco.
 * Fixe a tag no hash do commit (não em @main): este script roda dentro de apps autenticados.
 */
(function (global) {
  'use strict';
  if (global.LemebelAvisos) return;

  var MAX_VISIVEIS = 3;
  var INTERVALO_MIN_MS = 15 * 60 * 1000;
  var ROTULO = { info: 'Novidade', aviso: 'Atenção', critico: 'Importante' };
  var estado = null; // { cfg, el, ultima, onVis, dispensados }

  var CSS =
    '#lemebel-avisos{position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:50%;transform:translateX(-50%);' +
    'width:min(560px,calc(100vw - 24px));z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none}' +
    '#lemebel-avisos .lav{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;padding:12px 12px 12px 14px;' +
    'background:var(--surface,#fff);color:var(--text,#1c1917);border:1px solid var(--line,#e7e0d3);border-left-width:5px;' +
    'border-radius:var(--radius-md,12px);box-shadow:var(--shadow-lg,0 10px 26px rgba(20,20,24,.18));font-size:14px;line-height:1.45;font-family:inherit}' +
    '#lemebel-avisos .lav.info{border-left-color:var(--accent,#9D4321)}' +
    '#lemebel-avisos .lav.aviso{border-left-color:var(--warn,#c27803)}' +
    '#lemebel-avisos .lav.critico{border-left-color:var(--bad,#c0392b)}' +
    '#lemebel-avisos .lav-corpo{flex:1;min-width:0}' +
    '#lemebel-avisos .lav-rotulo{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
    'padding:1px 8px;border-radius:999px;border:1px solid currentColor;margin-bottom:4px;color:var(--text,#1c1917);opacity:.8}' +
    '#lemebel-avisos .lav-titulo{font-weight:700;overflow-wrap:anywhere}' +
    '#lemebel-avisos .lav-msg{margin-top:2px;white-space:pre-line;overflow-wrap:anywhere;color:var(--gray,#57534e)}' +
    '#lemebel-avisos .lav-x{flex:0 0 auto;min-width:44px;min-height:44px;margin:-8px -4px -8px 0;border:0;background:transparent;' +
    'color:inherit;font-size:22px;line-height:1;cursor:pointer;border-radius:10px}' +
    '#lemebel-avisos .lav-x:hover{background:rgba(0,0,0,.06)}' +
    '#lemebel-avisos .lav-x:focus-visible{outline:2px solid var(--accent,#9D4321);outline-offset:1px}' +
    '@media (prefers-reduced-motion:no-preference){#lemebel-avisos .lav{animation:lavIn .18s ease-out}' +
    '@keyframes lavIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}}';

  function garantirEstilo() {
    if (document.getElementById('lemebel-avisos-css')) return;
    var st = document.createElement('style');
    st.id = 'lemebel-avisos-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function criarItem(a) {
    var sev = ROTULO[a.severidade] ? a.severidade : 'info';
    var li = document.createElement('div');
    li.className = 'lav ' + sev;
    li.setAttribute('role', sev === 'critico' ? 'alert' : 'status');
    li.setAttribute('data-aviso-id', String(a.id));

    var corpo = document.createElement('div');
    corpo.className = 'lav-corpo';
    var rot = document.createElement('span');
    rot.className = 'lav-rotulo';
    rot.textContent = ROTULO[sev];
    var tit = document.createElement('div');
    tit.className = 'lav-titulo';
    tit.textContent = String(a.titulo == null ? '' : a.titulo);
    corpo.appendChild(rot);
    corpo.appendChild(tit);
    if (a.corpo) {
      var msg = document.createElement('div');
      msg.className = 'lav-msg';
      msg.textContent = String(a.corpo);
      corpo.appendChild(msg);
    }

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'lav-x';
    x.setAttribute('aria-label', 'Dispensar aviso: ' + tit.textContent);
    x.textContent = '×';
    x.addEventListener('click', function () { dispensar(a.id); });

    li.appendChild(corpo);
    li.appendChild(x);
    return li;
  }

  function renderizar(lista) {
    if (!estado) return;
    estado.todos = Array.isArray(lista) ? lista : []; // guarda a fila inteira: ao dispensar, o próximo entra
    var vis = estado.todos
      .filter(function (a) { return a && Number.isInteger(Number(a.id)) && !estado.dispensados[a.id]; })
      .slice(0, MAX_VISIVEIS);
    if (!vis.length) { if (estado.el) { estado.el.remove(); estado.el = null; } return; }
    garantirEstilo();
    if (!estado.el) {
      estado.el = document.createElement('div');
      estado.el.id = 'lemebel-avisos';
      estado.el.setAttribute('role', 'region');
      estado.el.setAttribute('aria-label', 'Avisos da Lemebel');
      document.body.appendChild(estado.el);
    }
    estado.el.textContent = '';
    vis.forEach(function (a) { estado.el.appendChild(criarItem(a)); });
  }

  function dispensar(id) {
    if (!estado) return;
    estado.dispensados[id] = true; // some na hora; o servidor registra em segundo plano
    renderizar(estado.todos);
    try {
      var p = estado.cfg.dispensar(id);
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* silencioso */ }
  }

  function buscar() {
    if (!estado) return;
    estado.ultima = Date.now();
    try {
      var p = estado.cfg.listar();
      if (p && p.then) p.then(renderizar, function () {});
    } catch (e) { /* silencioso */ }
  }

  function iniciar(cfg) {
    if (estado || !cfg || typeof cfg.listar !== 'function' || typeof cfg.dispensar !== 'function') return;
    estado = { cfg: cfg, el: null, ultima: 0, dispensados: {}, todos: [] };
    estado.onVis = function () {
      if (document.visibilityState === 'visible' && Date.now() - estado.ultima > INTERVALO_MIN_MS) buscar();
    };
    document.addEventListener('visibilitychange', estado.onVis);
    buscar();
  }

  function parar() {
    if (!estado) return;
    document.removeEventListener('visibilitychange', estado.onVis);
    if (estado.el) estado.el.remove();
    estado = null;
  }

  global.LemebelAvisos = { iniciar: iniciar, parar: parar, _renderizar: renderizar };
})(window);
