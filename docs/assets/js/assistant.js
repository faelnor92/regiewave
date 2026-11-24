/* RegieWave — assistant du site (la mascotte). Ce n'est PAS une IA : il cherche dans les réponses
   écrites d'avance (assistant-data.js) et, si besoin, dans le manuel du logiciel (assistant-manuel.js,
   chargé seulement à ce moment-là). Tout se passe dans le navigateur : aucune question n'est envoyée.
   Il ne garde, le temps de l'onglet (sessionStorage), que l'état de la visite guidée et le fait
   d'avoir montré sa bulle d'accueil. */
(function () {
  'use strict';
  var ALL = window.RW_ASSISTANT;
  if (!ALL) return;
  var L = document.documentElement.lang === 'en' ? 'en' : 'fr';
  var D = ALL[L], UI = D.ui;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var PAGE = document.body.getAttribute('data-page') || '';
  var IMG = '../assets/img/mascotte-192.png';
  // Depuis le manuel (dossier manuel/), les pages du site sont dans ../fr/.
  var PRE = PAGE === 'manual' ? '../fr/' : '';
  function fixHtml(h) { return PRE ? h.replace(/href="(?!https?:|#|\.\.\/)([^"]+)"/g, 'href="' + PRE + '$1"') : h; }
  function fixHref(h) { return PRE && !/^(https?:|#|\.\.\/)/.test(h) ? PRE + h : h; }
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  /* ───────── recherche ───────── */
  var STOP = {};
  D.stop.split(/\s+/).forEach(function (w) { STOP[w] = 1; });
  // Identique à normalize() de manuel.py (mots vides du manuel en plus, voir MSTOP).
  function normalize(text, extraStop) {
    text = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var out = [];
    text.replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(function (w) {
      if (!w || w.length < 2 || STOP[w] || (extraStop && extraStop[w])) return;
      if (w.length > 3 && (w.slice(-1) === 's' || w.slice(-1) === 'x')) w = w.slice(0, -1);
      out.push(w);
    });
    return out;
  }
  var MSTOP = {};
  ('si ainsi aussi alors donc mais car comme tout tous toute toutes chaque autre autres meme fait faire faites cliquez clic choisir choisissez ouvre ouvrez puis ensuite')
    .split(' ').forEach(function (w) { MSTOP[w] = 1; });

  function lev1(a, b) { // distance de Levenshtein <= 1 ?
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return diff + (la - i) + (lb - j) <= 1;
  }

  var kb = D.kb.map(function (entry) {
    var keys = {};
    entry.keys.split(/\s+/).forEach(function (raw) {
      if (!raw) return;
      var strong = raw.charAt(raw.length - 1) === '*';
      normalize(raw.replace(/\*/g, '').replace(/-/g, ' ')).forEach(function (t) {
        if (!keys[t] || strong) keys[t] = strong ? 3 : 2;
      });
    });
    return { e: entry, keys: keys };
  });

  // Un mot-clé qu'un seul sujet connaît pèse plus lourd que celui que plusieurs partagent.
  var kdf = {};
  kb.forEach(function (item) { for (var k in item.keys) kdf[k] = (kdf[k] || 0) + 1; });
  function scoreKb(tokens) {
    return kb.map(function (item) {
      var s = 0;
      tokens.forEach(function (t) {
        var w = item.keys[t];
        if (w) { s += w * (1 + 1 / kdf[t]); return; }
        if (t.length >= 5) for (var k in item.keys) if (k.length >= 5 && lev1(t, k)) { s += item.keys[k] * 0.5 * (1 + 1 / kdf[k]); break; }
      });
      return { e: item.e, s: s };
    }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  }

  var manual = null, manualLoading = null, mdf = {}, mN = 1;
  function loadManual() {
    if (window.RW_MANUEL) { manual = window.RW_MANUEL; return Promise.resolve(manual); }
    if (manualLoading) return manualLoading;
    manualLoading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '../assets/js/assistant-manuel.js';
      s.onload = function () {
        manual = window.RW_MANUEL || [];
        mN = Math.max(1, manual.length);
        manual.forEach(function (c) { c.w = c.k.split(' '); c.w.forEach(function (t) { mdf[t] = (mdf[t] || 0) + 1; }); });
        resolve(manual);
      };
      s.onerror = function () { manual = []; resolve(manual); };
      document.head.appendChild(s);
    });
    return manualLoading;
  }
  // Un mot rare du manuel (peu de sections le portent) pèse plus lourd qu'un mot courant.
  function idf(t) { return mdf[t] ? Math.log(1 + mN / mdf[t]) : 0; }
  function searchManual(tokens, limit) {
    if (!manual || !tokens.length) return [];
    var RARE = Math.log(1 + mN / 12), res = [];
    manual.forEach(function (c) {
      var title = normalize(c.t + ' ' + c.p, MSTOP), score = 0, hit = 0, rare = [], titleRare = false;
      tokens.forEach(function (t) {
        var i = c.w.indexOf(t), inTitle = title.indexOf(t) >= 0, w = idf(t);
        if (i < 0 && t.length >= 6) { // formes proches (« sauvegarder » / « sauvegarde »)
          for (var j = 0; j < c.w.length; j++) {
            var u = c.w[j];
            if (u.length >= 6 && (u.indexOf(t) === 0 || t.indexOf(u) === 0)) { i = j; w = Math.max(w, idf(u)); break; }
          }
        }
        if (i < 0 && !inTitle) return;
        hit++;
        score += w * (1 + (i >= 0 ? 0.3 * (1 - i / c.w.length) : 0)) + (inTitle ? 1.2 * w : 0);
        if (w >= RARE) { rare.push(t); if (inTitle) titleRare = true; }
      });
      if (score >= 2.5 && (hit >= 2 || rare.length)) res.push({ c: c, s: score, hit: hit, rare: rare, titleRare: titleRare });
    });
    return res.sort(function (a, b) { return b.s - a.s; }).slice(0, limit || 3);
  }

  /* Réponse à une question : { kind: 'kb' | 'manual' | 'none', ... }.
     Un sujet général aux mots-clés solides gagne ; le manuel prend la main quand la question contient
     un mot précis (« police », « LUT ») que le sujet ignore et que deux mots de la question retrouvent
     dans une même section, ou quand le sujet général est peu sûr. */
  function ask(question) {
    var tokens = normalize(question);
    var ranked = scoreKb(tokens), top = ranked[0];
    var kbScore = top ? top.s : 0;
    return loadManual().then(function () {
      var found = searchManual(normalize(question, MSTOP)), m0 = found[0];
      var strong = !!m0 && ((m0.hit >= 2 && m0.s >= 3) || m0.titleRare);
      var leftover = false;
      if (m0 && top) {
        var item = kb.filter(function (k) { return k.e === top.e; })[0];
        leftover = m0.rare.some(function (t) { return !item.keys[t]; });
      }
      var useManual = kbScore >= 5 ? (strong && leftover) : kbScore >= 2 ? !!m0 && (kbScore < 4 || strong) : !!m0;
      if (useManual) return { kind: 'manual', found: found, near: ranked.slice(0, 3) };
      if (kbScore >= 2) return { kind: 'kb', entry: top.e, found: found.slice(0, 2), near: ranked.slice(1, 4) };
      return { kind: 'none', near: ranked.slice(0, 3) };
    });
  }
  var API = window.RW_ASSISTANT_API = { ask: ask, normalize: normalize };

  /* ───────── interface ───────── */
  var el = function (tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  function avatar(cls) {
    var wrap = el('span', 'rw-float ' + (cls || '')), look = el('span', 'rw-look'), img = el('img', 'rw-img', { src: IMG, alt: '', width: '96', height: '96', decoding: 'async' });
    look.appendChild(img); wrap.appendChild(look);
    return wrap;
  }
  function setTalking(on) {
    Array.prototype.forEach.call(document.querySelectorAll('.rw-root .rw-float, .rw-tip .rw-float'), function (n) { n.classList.toggle('is-talking', !!on); });
  }

  var root = el('div', 'rw-root');
  var launch = el('button', 'rw-launch', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rw-panel', 'aria-label': UI.open });
  var launchAvatar = avatar('rw-main');
  launch.appendChild(launchAvatar);
  var teaser = el('div', 'rw-teaser', { role: 'status', hidden: '' });
  var teaserText = el('button', 'rw-teaser-text', { type: 'button' });
  teaserText.textContent = UI.teaser;
  var teaserClose = el('button', 'rw-teaser-x', { type: 'button', 'aria-label': UI.close });
  teaserClose.textContent = '×';
  teaser.appendChild(teaserText); teaser.appendChild(teaserClose);

  var panel = el('section', 'rw-panel', { id: 'rw-panel', role: 'dialog', 'aria-label': UI.title, hidden: '' });
  var head = el('header', 'rw-head');
  var headAvatar = avatar('rw-small');
  var headTitle = el('div', 'rw-title');
  var strong = el('strong'); strong.textContent = UI.title;
  headTitle.appendChild(strong);
  var tourBtn = el('button', 'rw-tourbtn', { type: 'button' });
  tourBtn.textContent = UI.tour;
  var closeBtn = el('button', 'rw-x', { type: 'button', 'aria-label': UI.close });
  closeBtn.textContent = '×';
  head.appendChild(headAvatar); head.appendChild(headTitle); head.appendChild(tourBtn); head.appendChild(closeBtn);
  var log = el('div', 'rw-log', { role: 'log', 'aria-live': 'polite', tabindex: '0' });
  var chips = el('div', 'rw-chips');
  var form = el('form', 'rw-form', { autocomplete: 'off' });
  var input = el('input', 'rw-input', { type: 'text', 'aria-label': UI.placeholder, placeholder: UI.placeholder, maxlength: '200', enterkeyhint: 'send' });
  var send = el('button', 'rw-send', { type: 'submit', 'aria-label': UI.send });
  send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  form.appendChild(input); form.appendChild(send);
  var foot = el('p', 'rw-foot'); foot.textContent = UI.note;
  panel.appendChild(head); panel.appendChild(log); panel.appendChild(chips); panel.appendChild(form); panel.appendChild(foot);
  root.appendChild(teaser); root.appendChild(panel); root.appendChild(launch);
  document.body.appendChild(root);

  var isOpen = false, greeted = false;

  /* ───────── position : la mascotte se déplace à la souris, au doigt ou avec Maj + flèches ───────── */
  var pos = { r: 18, b: 18 }; // distances aux bords droit et bas de la fenêtre
  var vwidth = function () { return document.documentElement.clientWidth || window.innerWidth; };
  function clampPos() {
    var size = launch.offsetWidth || 92;
    pos.r = Math.max(8, Math.min(vwidth() - size - 8, pos.r));
    pos.b = Math.max(8, Math.min(window.innerHeight - size - 8, pos.b));
  }
  // La discussion s'ouvre du côté où il y a le plus de place, sans sortir de l'écran.
  function placePanel() {
    var rr = root.getBoundingClientRect(), vw = vwidth(), vh = window.innerHeight, gap = 12;
    var w = Math.min(392, vw - 24);
    var above = rr.top - gap - 8, below = vh - rr.bottom - gap - 8, up = above >= below;
    var h = Math.max(200, Math.min(580, up ? above : below));
    var left = Math.max(12, Math.min(vw - w - 12, rr.left + rr.width / 2 - w / 2)) - rr.left;
    panel.style.width = w + 'px'; panel.style.height = h + 'px';
    panel.style.left = left + 'px'; panel.style.right = 'auto';
    panel.style.transformOrigin = up ? '50% 100%' : '50% 0';
    if (up) { panel.style.bottom = (rr.height + gap) + 'px'; panel.style.top = 'auto'; }
    else { panel.style.top = (rr.height + gap) + 'px'; panel.style.bottom = 'auto'; }
  }
  function placeTeaser() {
    var rr = root.getBoundingClientRect(), vh = window.innerHeight, gap = 12;
    var right = rr.left + rr.width / 2 > vwidth() / 2;
    teaser.style.left = right ? 'auto' : '8px'; teaser.style.right = right ? '8px' : 'auto';
    if (rr.top > 110 || rr.top > vh - rr.bottom) { teaser.style.bottom = (rr.height + gap) + 'px'; teaser.style.top = 'auto'; }
    else { teaser.style.top = (rr.height + gap) + 'px'; teaser.style.bottom = 'auto'; }
  }
  function applyPos() {
    clampPos();
    root.style.setProperty('--rw-r', pos.r + 'px'); root.style.setProperty('--rw-b', pos.b + 'px');
    if (isOpen) placePanel();
    if (!teaser.hidden) placeTeaser();
  }
  function savePos() { store.set('rw-pos', Math.round(pos.r) + ',' + Math.round(pos.b)); }
  var savedPos = (store.get('rw-pos') || '').split(',').map(Number);
  if (savedPos.length === 2 && isFinite(savedPos[0]) && isFinite(savedPos[1])) { pos.r = savedPos[0]; pos.b = savedPos[1]; }
  launch.title = UI.dragHint;

  var drag = null, dragMoved = false;
  launch.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, r: pos.r, b: pos.b, id: e.pointerId, on: false };
    dragMoved = false;
    try { launch.setPointerCapture(e.pointerId); } catch (x) {}
  });
  launch.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 6) return; // en dessous : c'est un clic
      drag.on = true; dragMoved = true;
      launchAvatar.classList.add('is-held'); launch.classList.add('is-dragging');
      teaser.hidden = true;
    }
    pos.r = drag.r - dx; pos.b = drag.b - dy;
    applyPos();
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.on) {
      launchAvatar.classList.remove('is-held'); launch.classList.remove('is-dragging');
      if (!reduced) { launchAvatar.classList.add('is-hop'); setTimeout(function () { launchAvatar.classList.remove('is-hop'); }, 1100); }
      savePos();
    }
    drag = null;
  }
  launch.addEventListener('pointerup', endDrag);
  launch.addEventListener('pointercancel', endDrag);
  launch.addEventListener('keydown', function (e) { // au clavier : Maj + flèches
    var step = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] }[e.key];
    if (!e.shiftKey || !step) return;
    e.preventDefault();
    pos.r += step[0]; pos.b += step[1];
    applyPos(); savePos();
  });
  window.addEventListener('resize', applyPos);
  applyPos();
  function open(focus) {
    if (isOpen) return;
    isOpen = true;
    teaser.hidden = true;
    panel.hidden = false;
    placePanel();
    requestAnimationFrame(function () { panel.classList.add('on'); });
    launch.setAttribute('aria-expanded', 'true');
    launch.classList.add('is-open');
    if (!greeted) { greeted = true; bot(UI.hello, [{ label: UI.tour, tour: 'full' }], true); renderChips(UI.suggestions); }
    if (focus !== false) setTimeout(function () { input.focus(); }, 60);
    store.set('rw-seen', '1');
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('on');
    launch.setAttribute('aria-expanded', 'false');
    launch.classList.remove('is-open');
    setTimeout(function () { if (!isOpen) panel.hidden = true; }, reduced ? 0 : 220);
    setTalking(false);
  }
  launch.addEventListener('click', function () { if (dragMoved) { dragMoved = false; return; } isOpen ? close() : open(); });
  closeBtn.addEventListener('click', function () { close(); launch.focus(); });
  tourBtn.addEventListener('click', function () { close(); startTour('full'); });
  teaserText.addEventListener('click', function () { open(); });
  teaserClose.addEventListener('click', function () { teaser.hidden = true; store.set('rw-seen', '1'); });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); launch.focus(); } });

  function renderChips(list) {
    chips.textContent = '';
    list.forEach(function (c) {
      var b = el('button', 'rw-chip', { type: 'button' });
      b.textContent = c.label;
      b.addEventListener('click', function () {
        if (c.tour) { close(); startTour(c.tour); } else if (c.id) { showEntry(c.id, c.label); } else if (c.q) { userAsk(c.q); }
      });
      chips.appendChild(b);
    });
  }

  function scrollLog() { log.scrollTop = log.scrollHeight; }
  function user(text) {
    var m = el('div', 'rw-msg rw-user');
    m.textContent = text;
    log.appendChild(m); scrollLog();
  }

  // Écrit le HTML d'une réponse petit à petit (texte seulement : les liens restent intacts).
  function typeInto(node, html, done) {
    node.innerHTML = html;
    if (reduced) { done && done(); return; }
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), texts = [], n;
    while ((n = walker.nextNode())) texts.push({ n: n, full: n.nodeValue });
    texts.forEach(function (t) { t.n.nodeValue = ''; });
    var ti = 0, ci = 0, timer = null, skipped = false;
    function finish() { clearInterval(timer); texts.forEach(function (t) { t.n.nodeValue = t.full; }); setTalking(false); node.removeEventListener('click', skip); scrollLog(); done && done(); }
    function skip() { skipped = true; finish(); }
    node.addEventListener('click', skip);
    setTalking(true);
    timer = setInterval(function () {
      if (skipped) return;
      var t = texts[ti];
      if (!t) return finish();
      ci = Math.min(t.full.length, ci + 4);
      t.n.nodeValue = t.full.slice(0, ci);
      if (ci >= t.full.length) { ti++; ci = 0; if (ti >= texts.length) return finish(); }
      scrollLog();
    }, 16);
  }

  function bot(html, actions, instant) {
    var m = el('div', 'rw-msg rw-bot');
    var body = el('div', 'rw-body');
    m.appendChild(body);
    log.appendChild(m);
    var addActions = function () {
      if (!actions || !actions.length) return;
      var row = el('div', 'rw-actions');
      actions.forEach(function (a) {
        var node;
        if (a.href) { node = el('a', 'rw-btn', { href: fixHref(a.href) }); if (/^https?:/.test(a.href)) { node.target = '_blank'; node.rel = 'noopener'; } }
        else { node = el('button', 'rw-btn', { type: 'button' }); }
        node.textContent = a.label;
        if (a.tab) node.addEventListener('click', function () { close(); startTour('tab:' + a.tab); });
        if (a.tour) node.addEventListener('click', function () { close(); startTour(a.tour); });
        row.appendChild(node);
      });
      m.appendChild(row); scrollLog();
    };
    html = fixHtml(html);
    if (instant) { body.innerHTML = html; addActions(); scrollLog(); } else typeInto(body, html, addActions);
    scrollLog();
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function showEntry(id, label) {
    var item = D.kb.filter(function (k) { return k.id === id; })[0];
    if (!item) return;
    if (label) user(label);
    bot(item.a, item.actions);
  }

  var TITLES = D.titles || {};
  function nearChips(near) {
    var seen = {}, list = [];
    near.forEach(function (r) {
      var id = r.e.id;
      if (seen[id] || !TITLES[id]) return;
      seen[id] = 1; list.push({ label: TITLES[id], id: id });
    });
    return list.length ? list : UI.suggestions;
  }

  // Libellé d'un bouton du manuel : le titre de la section, précédé de sa page s'il est trop court.
  function shortPage(p) { return p.split(/\s[:–—]\s/)[0]; } // « Composition : bandeaux… » → « Composition »
  function label(c) {
    var t = c.t.length < 14 ? shortPage(c.p) + ' › ' + c.t : c.t;
    return t.length > 54 ? t.slice(0, 52).replace(/\s+\S*$/, '') + '…' : t;
  }
  var queue = Promise.resolve();
  function userAsk(q) {
    q = (q || '').trim();
    if (!q) return;
    if (!isOpen) open(false);
    user(q);
    // Les questions posées coup sur coup reçoivent leurs réponses dans l'ordre.
    queue = queue.then(function () {
      return new Promise(function (done) { setTimeout(done, reduced ? 0 : 280); }).then(function () { return ask(q); }).then(function (r) {
        if (r.kind === 'kb') {
          var more = (r.entry.actions || []).slice();
          (r.found || []).forEach(function (f) { if (!more.some(function (m) { return m.href && m.href.indexOf(f.c.u) >= 0; })) more.push({ label: UI.manualShort + label(f.c), href: '../manuel/' + f.c.u }); });
          bot(r.entry.a, more);
          renderChips(r.near.length ? nearChips(r.near).slice(0, 3) : UI.suggestions);
        } else if (r.kind === 'manual') {
          var top = r.found[0].c;
          var html = '<b>' + esc(UI.manualFound) + '</b> ' + esc(shortPage(top.p)) + ' → ' + esc(top.t) + '<br>' + esc(top.e);
          var actions = [{ label: UI.manualRead, href: '../manuel/' + top.u }];
          r.found.slice(1).forEach(function (f) { actions.push({ label: label(f.c), href: '../manuel/' + f.c.u }); });
          bot(html, actions);
          renderChips(nearChips(r.near));
        } else {
          bot(UI.fallback, [{ label: UI.ticket, href: D.issues }]);
          renderChips(nearChips(r.near));
        }
      });
    });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); var q = input.value; input.value = ''; userAsk(q); });

  /* ───────── la mascotte bouge ───────── */
  // Vague à l'arrivée, regard qui suit la souris, bondit quand elle parle.
  if (!reduced) {
    setTimeout(function () { launchAvatar.classList.add('is-wave'); setTimeout(function () { launchAvatar.classList.remove('is-wave'); }, 1800); }, 900);
    if (finePointer) {
      var tx = 0, ty = 0, tr = 0, ticking = false;
      window.addEventListener('pointermove', function (e) {
        var r = launch.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        var d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, d / 420);
        tx = dx / d * 7 * k; ty = dy / d * 5 * k; tr = Math.max(-9, Math.min(9, dx / 90));
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () {
            ticking = false;
            Array.prototype.forEach.call(document.querySelectorAll('.rw-root .rw-look'), function (n) {
              n.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + tr.toFixed(1) + 'deg)';
            });
          });
        }
      }, { passive: true });
    }
  }

  /* bulle d'accueil, une seule fois par onglet */
  if (PAGE !== 'manual' && !store.get('rw-seen') && !store.get('rw-tour')) {
    setTimeout(function () {
      if (isOpen || store.get('rw-seen') || store.get('rw-tour')) return;
      teaser.hidden = false;
      placeTeaser();
      teaser.classList.add('on');
      launchAvatar.classList.add('is-hop');
      setTimeout(function () { launchAvatar.classList.remove('is-hop'); }, 1200);
      setTimeout(function () { teaser.hidden = true; }, 12000);
      store.set('rw-seen', '1');
    }, 8000);
  }

  /* ───────── visite guidée ───────── */
  var tip = null, spot = null, shield = null, tour = null, raf = 0;

  function tourSteps(kind) {
    if (kind === 'full') return D.tour;
    var name = kind.split(':')[1];
    return D.tabtext[name] ? [{ page: 'home', target: 'ateliers', tab: name, text: D.tabtext[name] }] : [];
  }
  function startTour(kind, index) {
    var steps = tourSteps(kind);
    if (!steps.length) return;
    tour = { kind: kind, steps: steps, i: index || 0 };
    go(tour.i);
  }
  function go(i) {
    if (i < 0) i = 0;
    if (i >= tour.steps.length) return endTour(true);
    tour.i = i;
    var step = tour.steps[i];
    store.set('rw-tour', JSON.stringify({ kind: tour.kind, i: i }));
    if (step.page !== PAGE) { location.href = PRE + D.pages[step.page]; return; }
    show(step);
  }
  function target(step) { return document.querySelector('[data-tour="' + step.target + '"]'); }

  function show(step) {
    var node = target(step);
    if (!node) { go(tour.i + 1); return; }
    if (step.tab) { var tb = document.getElementById('tab-' + step.tab); if (tb) tb.click(); }
    if (!shield) {
      shield = el('div', 'rw-shield'); spot = el('div', 'rw-spot');
      tip = el('div', 'rw-tip', { role: 'dialog', 'aria-label': UI.tour });
      document.body.appendChild(shield); document.body.appendChild(spot); document.body.appendChild(tip);
      window.addEventListener('resize', place); window.addEventListener('scroll', place, { passive: true });
      document.addEventListener('keydown', tourKey);
    }
    tip.textContent = '';
    var top = el('div', 'rw-tip-top');
    top.appendChild(avatar('rw-small'));
    var counter = el('span', 'rw-count'); counter.textContent = UI.step + ' ' + (tour.i + 1) + ' / ' + tour.steps.length;
    top.appendChild(counter);
    var q = el('button', 'rw-tip-x', { type: 'button', 'aria-label': UI.quit }); q.textContent = '×'; q.addEventListener('click', function () { endTour(false); });
    top.appendChild(q);
    var text = el('p', 'rw-tip-text'); text.innerHTML = step.text;
    var nav = el('div', 'rw-tip-nav');
    var prev = el('button', 'rw-btn rw-ghost', { type: 'button' }); prev.textContent = UI.prev; prev.disabled = tour.i === 0; prev.addEventListener('click', function () { go(tour.i - 1); });
    var next = el('button', 'rw-btn', { type: 'button' }); next.textContent = tour.i === tour.steps.length - 1 ? UI.done : UI.next; next.addEventListener('click', function () { go(tour.i + 1); });
    nav.appendChild(prev); nav.appendChild(next);
    tip.appendChild(top); tip.appendChild(text); tip.appendChild(nav);
    tip.classList.add('on');
    setTalking(false);
    node.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    var frames = 0; // suit la cible pendant le défilement doux (environ une seconde)
    cancelAnimationFrame(raf);
    (function loop() { place(); if (++frames < 60) raf = requestAnimationFrame(loop); })();
    setTimeout(function () { next.focus({ preventScroll: true }); }, 80);
  }

  function place() {
    if (!tour || !spot) return;
    var step = tour.steps[tour.i], node = target(step);
    if (!node) return;
    var r = node.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, pad = 12;
    var h = Math.min(r.height + pad * 2, vh * 0.72);
    var x = Math.max(8, r.left - pad), y = Math.max(8, r.top - pad);
    var w = Math.min(vw - 16 - (x - 8), r.width + pad * 2);
    spot.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    // Voile avec un trou à l'emplacement de la cible (le voile assombrit tout le reste).
    var hole = 'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' + x + 'px ' + y + 'px, ' + x + 'px ' + (y + h) + 'px, ' + (x + w) + 'px ' + (y + h) + 'px, ' + (x + w) + 'px ' + y + 'px, ' + x + 'px ' + y + 'px)';
    shield.style.clipPath = hole; shield.style.webkitClipPath = hole;
    var th = tip.offsetHeight || 190, tw = Math.min(360, vw - 24);
    var below = y + h + 14, above = y - th - 14;
    var ty = below + th <= vh - 8 ? below : (above >= 8 ? above : Math.max(8, vh - th - 14));
    var tx = Math.max(12, Math.min(vw - tw - 12, x + w / 2 - tw / 2));
    tip.style.cssText = 'left:' + tx + 'px;top:' + ty + 'px;width:' + tw + 'px';
  }

  function tourKey(e) {
    if (!tour) return;
    if (e.key === 'Escape') endTour(false);
    else if (e.key === 'ArrowRight') go(tour.i + 1);
    else if (e.key === 'ArrowLeft') go(tour.i - 1);
  }

  function endTour(finished) {
    store.del('rw-tour');
    var kind = tour && tour.kind;
    tour = null;
    cancelAnimationFrame(raf);
    [shield, spot, tip].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    shield = spot = tip = null;
    window.removeEventListener('resize', place); window.removeEventListener('scroll', place);
    document.removeEventListener('keydown', tourKey);
    if (finished && kind === 'full') { open(false); bot(UI.end, [{ label: UI.download, href: PRE + D.pages.download }]); renderChips(UI.suggestions); }
    else launch.focus({ preventScroll: true });
  }

  /* reprise après un changement de page, liens #assistant et #visite */
  function resume() {
    var saved = store.get('rw-tour');
    if (saved) {
      try {
        var s = JSON.parse(saved);
        if (s && typeof s.i === 'number') {
          var steps = tourSteps(s.kind);
          if (steps.length && steps[s.i] && steps[s.i].page === PAGE) { tour = { kind: s.kind, steps: steps, i: s.i }; setTimeout(function () { show(steps[s.i]); }, 450); return; }
        }
      } catch (e) {}
      store.del('rw-tour');
    }
    if (location.hash === '#visite') startTour('full');
    else if (location.hash === '#assistant') open();
  }
  if (document.readyState === 'complete') resume(); else window.addEventListener('load', resume);
  API.open = open; API.say = userAsk; API.tour = startTour;
  API.searchManual = function (q, limit) { return loadManual().then(function () { return searchManual(normalize(q, MSTOP), limit || 8); }); };
  window.addEventListener('hashchange', function () {
    if (location.hash === '#visite') startTour('full'); else if (location.hash === '#assistant') open();
  });
})();
