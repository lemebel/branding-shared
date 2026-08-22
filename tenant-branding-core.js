/*
 * LEMEBEL — núcleo compartilhado de marca por tenant (client-side)
 * -----------------------------------------------------------------
 * Extraído em 02/08/2026 do tenant-branding.js do Qualidade e Consultoria
 * (código quase idêntico entre os dois, só a config de vertente mudava).
 * Descobre qual empresa está abrindo o sistema (?e= > /c/slug > subdomínio >
 * memória) e aplica a marca dela: cores, título, favicon, ícone do app e a
 * logo dentro do sistema. A marca vem do banco (tabela `empresas`,
 * compartilhada entre as vertentes da Lemebel).
 *
 * Cada produto carrega este arquivo ANTES do seu tenant-branding.js local
 * (que agora só declara a config da vertente e chama LemebelBranding.iniciar).
 * Hospedado num repo público (lemebel/branding-shared) porque um <script src>
 * no navegador não consegue autenticar — CDN de repo privado não funciona
 * pra código client-side. Não contém segredo nenhum: a SB_KEY usada aqui é a
 * chave pública "anon" do Supabase, que já fica exposta no HTML de qualquer
 * jeito.
 *
 * gestao/tenant-branding.js NÃO usa este núcleo ainda (tem catálogo local de
 * múltiplos tenants com nome próprio — BROWNI-SE, Órbita legado — e detecção
 * de host de plataforma que os outros dois produtos não têm). Pode migrar
 * pra cá depois se fizer sentido generalizar mais esse caso.
 *
 * config esperado em LemebelBranding.iniciar(config):
 *   sbUrl, sbKey        — Supabase (mesmo projeto pras 3 vertentes hoje)
 *   padrao              — {nome, cores:{accent,accent2,dark,dark2,gold,gold2,soft}, logo, icone, manifest, temaBarra}
 *   storageKey          — chave do localStorage pra lembrar o slug (ex.: 'lemebel_qual_slug')
 *   reservados          — array de subdomínios que NÃO são slug de tenant (ex.: ['qualidade','lemebel','www','localhost','vercel','127'])
 *   tituloSufixo         — ex.: ' — Sistema de Qualidade' (usado no <title> e no manifest.name)
 *   manifestDescricao    — function(nome) => string, descrição do manifest.json dinâmico
 *   logoPattern          — RegExp: quais <img src> trocar pela logo do tenant (ex.: /logo-symbol\.png$|lemebel-mark\.svg$/i)
 */
(function (global) {
  'use strict';

  function iniciar(config) {
    var SB_URL = config.sbUrl;
    var SB_KEY = config.sbKey;
    var PADRAO = config.padrao;
    var slug = detectarSlug();

    // 1) pinta já com a identidade oficial da vertente (evita piscar)
    aplicar(PADRAO);
    global.EMPRESA = Object.assign({ slug: slug || null }, PADRAO);

    // Promessa que a tela (index.html do produto) espera antes de tirar a cortina
    // de carregamento: sem slug não há marca de tenant pra sobrepor (resolve na
    // hora); com slug, espera o 'empresa-carregada' (marca real já aplicada) —
    // com teto de 1.2s pra nunca travar se a rede cair.
    global.LEMEBEL_MARCA_PRONTA = !slug ? Promise.resolve() : new Promise(function (res) {
      document.addEventListener('empresa-carregada', function once() {
        document.removeEventListener('empresa-carregada', once);
        res();
      }, { once: true });
      setTimeout(res, 1200);
    });

    // 2) se há empresa identificada, busca a marca real dela e sobrepõe
    if (slug) {
      buscarNoBanco(slug).then(function (e) {
        if (!e) return;
        var cores = e.cores && Object.keys(e.cores).length ? e.cores : PADRAO.cores;
        var marca = {
          nome: e.nome || PADRAO.nome,
          cores: cores,
          logo: e.logo_url || PADRAO.logo,
          icone: e.icone_url || e.logo_url || PADRAO.icone,
          manifest: PADRAO.manifest,
          temaBarra: (cores && cores.dark) || PADRAO.temaBarra
        };
        aplicar(marca);
        global.EMPRESA = Object.assign({ slug: slug, id: e.id, bloqueado: !!e.bloqueado }, marca);
        document.dispatchEvent(new CustomEvent('empresa-carregada', { detail: global.EMPRESA }));
        if (e.bloqueado) avisoSuspenso(marca.nome);
      }).catch(function () { /* fica com a identidade oficial da vertente */ });
    }

    function detectarSlug() {
      var par = new URLSearchParams(location.search).get('e');
      if (par) return lembrar(par.toLowerCase());

      var partes = location.pathname.split('/').filter(Boolean);
      if (partes[0] === 'c' && partes[1]) return lembrar(partes[1].toLowerCase());

      var sub = location.hostname.split('.')[0];
      if (sub && config.reservados.indexOf(sub) < 0 && location.hostname.split('.').length > 2) return lembrar(sub.toLowerCase());

      var memoria = null;
      try { memoria = localStorage.getItem(config.storageKey); } catch (e) {}
      if (memoria) return memoria;

      return null; // sem empresa conhecida: fica só na identidade oficial da vertente
    }
    function lembrar(s) {
      try { localStorage.setItem(config.storageKey, s); } catch (e) {}
      return s;
    }

    function avisoSuspenso(nome) {
      var d = document.createElement('div');
      d.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(10,10,12,.93);color:#fff;' +
        'display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;' +
        'font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Inter,sans-serif');
      d.innerHTML = '<div style="max-width:420px">' +
        '<div style="font-size:34px;margin-bottom:10px">&#128274;</div>' +
        '<h2 style="font-size:20px;margin-bottom:10px">Acesso suspenso</h2>' +
        '<p style="opacity:.85;font-size:14px">A assinatura de <b>' + (nome || 'sua empresa') + '</b> está em atraso. ' +
        'Assim que o pagamento for confirmado, o acesso volta automaticamente.</p>' +
        '<p style="opacity:.6;font-size:12.5px;margin-top:14px">Seus dados continuam guardados e intactos.</p></div>';
      var por = function () { if (document.body) document.body.appendChild(d); else setTimeout(por, 60); };
      por();
    }

    // Tenta o endpoint público da erp-api primeiro (mesmo padrão do gestao/tenant-branding.js
    // — não fala mais direto com o Supabase na maioria das vezes); só cai pro PostgREST
    // direto se a erp-api estiver fora do ar, como rede de segurança.
    var ERP_API = 'https://erp-api-qouq.onrender.com';
    function buscarNoBanco(s) {
      return fetch(ERP_API + '/api/v1/tenant-config?slug=' + encodeURIComponent(s), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (res && res.ok && res.tenant && res.tenant.id && res.tenant.slug === s) {
            var t = res.tenant;
            return { id: t.id, slug: t.slug, nome: t.nome, cores: t.branding.cores, logo_url: t.branding.logo_url, icone_url: t.branding.icone_url, bloqueado: !!t.bloqueado };
          }
          return buscarNoBancoDireto(s);
        })
        .catch(function () { return buscarNoBancoDireto(s); });
    }
    function buscarNoBancoDireto(s) {
      var url = SB_URL + '/rest/v1/empresas?select=id,slug,nome,cores,logo_url,icone_url,bloqueado&limit=1';
      return fetch(url, {
        cache: 'no-store',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'x-empresa': s }
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var e = j && j[0];
          if (!e) return null;
          if (e.slug && e.slug !== s) return null;
          return e;
        });
    }

    function aplicar(m) {
      var raiz = document.documentElement.style;
      if (m.cores) {
        var cs = derivar(m.cores);
        Object.keys(cs).forEach(function (k) {
          var nome = k.replace(/[A-Z]/g, function (L) { return '-' + L.toLowerCase(); });
          raiz.setProperty('--' + nome, cs[k]);
        });
      }
      document.title = m.nome + config.tituloSufixo;
      definirMeta('theme-color', m.temaBarra);
      definirMeta('apple-mobile-web-app-title', m.nome);
      definirLink('icon', m.icone);
      definirLink('apple-touch-icon', m.icone);
      definirManifest(m);
      trocarLogos(m.logo, m.logo === PADRAO.logo);
    }

    function definirManifest(m) {
      if (!slug || !m || !m.nome) { definirLink('manifest', (m && m.manifest) || 'manifest.json'); return; }
      try {
        var icone = m.icone || PADRAO.icone;
        var tipo = /\.svg($|\?)/i.test(icone) ? 'image/svg+xml' : 'image/png';
        var cores = m.cores || {};
        var manifesto = {
          name: m.nome + config.tituloSufixo,
          short_name: m.nome,
          description: config.manifestDescricao(m.nome),
          start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
          background_color: cores.dark || m.temaBarra || PADRAO.temaBarra,
          theme_color: m.temaBarra || cores.accent || PADRAO.cores.accent,
          lang: 'pt-BR',
          icons: [
            { src: icone, sizes: '192x192', type: tipo, purpose: 'any' },
            { src: icone, sizes: '512x512', type: tipo, purpose: 'any maskable' }
          ]
        };
        var blob = new Blob([JSON.stringify(manifesto)], { type: 'application/manifest+json' });
        definirLink('manifest', URL.createObjectURL(blob));
      } catch (e) { definirLink('manifest', 'manifest.json'); }
    }

    var logoAtual = null, agendado = false, observando = false;
    function trocarLogos(logo, ehPadrao) {
      logoAtual = logo;
      if (!logo || ehPadrao) return;
      var trocar = function () {
        agendado = false;
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
          var src = imgs[i].getAttribute('src') || '';
          if (config.logoPattern.test(src)) imgs[i].src = logoAtual;
        }
      };
      var agendar = function () {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(trocar);
      };
      agendar();
      if (!observando) {
        observando = true;
        document.addEventListener('DOMContentLoaded', agendar);
        new MutationObserver(agendar).observe(document.documentElement, { childList: true, subtree: true });
      }
    }

    function definirMeta(nome, conteudo) {
      if (!conteudo) return;
      var m = document.querySelector('meta[name="' + nome + '"]');
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', nome); document.head.appendChild(m); }
      m.setAttribute('content', conteudo);
    }
    function definirLink(rel, href) {
      if (!href) return;
      var l = document.querySelector('link[rel="' + rel + '"]');
      if (!l) { l = document.createElement('link'); l.setAttribute('rel', rel); document.head.appendChild(l); }
      l.setAttribute('href', href);
    }
  }

  // ---------------------------------------------------------------- cores
  function rgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(c) {
    return '#' + c.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  function lumin(c) {
    var a = c.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contraste(c1, c2) {
    var l1 = lumin(c1), l2 = lumin(c2);
    var a = Math.max(l1, l2), b = Math.min(l1, l2);
    return (a + 0.05) / (b + 0.05);
  }
  function mistura(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  }
  function textoSobre(c) {
    return contraste(c, [255, 255, 255]) >= contraste(c, [17, 17, 17]) ? '#ffffff' : '#111111';
  }
  global.LemebelCores = { rgb: rgb, hex: hex, contraste: contraste, textoSobre: textoSobre, mistura: mistura };

  function derivar(cores) {
    var c = Object.assign({}, cores || {});
    var a = rgb(c.accent);
    if (!a) return c;
    var a2 = rgb(c.accent2) || mistura(a, [255, 255, 255], 0.18);
    if (!c.accent2) c.accent2 = hex(a2);
    if (!c.dark) c.dark = hex(mistura(a, [10, 9, 14], 0.86));
    if (!c.dark2) c.dark2 = hex(mistura(a, [5, 5, 8], 0.93));
    if (!c.soft) c.soft = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',.07)';
    c.accentHover = c.accentHover || hex(mistura(a, [0, 0, 0], 0.12));
    c.onAccent = c.onAccent || textoSobre(a);
    c.onAccent2 = c.onAccent2 || textoSobre(a2);
    return c;
  }

  global.LemebelBranding = { iniciar: iniciar };
})(window);
