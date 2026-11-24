/* RegieWave — site de présentation. Aucune bibliothèque. Tout est un « plus » :
   sans ce script, le site reste complet et lisible. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* menu mobile */
  var btn = $('.menu-btn'), nav = $('.nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }

  /* langue choisie : retenue pour la prochaine visite */
  $$('.lang a').forEach(function (a) {
    a.addEventListener('click', function () { try { localStorage.setItem('rw-lang', a.lang); } catch (e) {} });
  });

  /* en-tête, progression, parallaxe : une seule boucle au défilement */
  var header = $('.site-header'), bar = $('.progress');
  var parallax = $$('[data-depth]');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle('scrolled', y > 8);
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    }
    if (!reduced) parallax.forEach(function (el) {
      el.style.translate = '0 ' + (y * parseFloat(el.dataset.depth)).toFixed(1) + 'px';
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* apparition au défilement */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  /* lueur qui suit le curseur */
  if (finePointer) $$('.card, .dl').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* inclinaison 3D de la capture du héros */
  var stage = $('.stage');
  if (stage && finePointer && !reduced) {
    var frame = $('.frame', stage), floats = $$('.float, .mascot', stage);
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.transform = 'rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg)';
      floats.forEach(function (f, i) { f.style.transform = 'translate(' + (x * (14 + i * 8)).toFixed(1) + 'px,' + (y * (10 + i * 6)).toFixed(1) + 'px)'; });
    });
    stage.addEventListener('pointerleave', function () {
      frame.style.transform = '';
      floats.forEach(function (f) { f.style.transform = ''; });
    });
  }

  /* onglets (flèches, début, fin) */
  $$('[data-tabs]').forEach(function (group) {
    var tabs = $$('[role="tab"]', group), panels = $$('[role="tabpanel"]', group);
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('on', on);
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, to = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') to = (i + 1) % n;
        else if (k === 'ArrowUp' || k === 'ArrowLeft') to = (i - 1 + n) % n;
        else if (k === 'Home') to = 0; else if (k === 'End') to = n - 1;
        if (to !== null) { e.preventDefault(); select(to, true); }
      });
    });
    select(0);
  });

  /* vidéo : rien n'est téléchargé avant le clic (15 Mo) */
  $$('[data-video]').forEach(function (box) {
    var play = $('.play', box);
    if (!play) return;
    play.addEventListener('click', function () {
      var v = document.createElement('video');
      v.src = box.dataset.video; v.controls = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute('aria-label', box.dataset.label || '');
      var poster = box.dataset.poster; if (poster) v.poster = poster;
      box.appendChild(v); play.remove(); v.focus();
    });
  });

  /* copier un texte */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.dataset.copy, done = b.dataset.done || 'OK', old = b.textContent;
      var ok = function () { b.textContent = done; setTimeout(function () { b.textContent = old; }, 1600); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, function () {});
      else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); }
    });
  });

  /* sommaire de la page des fonctions : section visible */
  var toc = $$('.toc a');
  if (toc.length && 'IntersectionObserver' in window) {
    var map = {};
    toc.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) map[s.id] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) { toc.forEach(function (a) { a.classList.remove('on'); }); map[en.target.id].classList.add('on'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }

  /* système de l'utilisateur : met en avant le bon téléchargement */
  var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var agent = navigator.userAgent || '';
  var os = /win/i.test(ua) || /Windows/.test(agent) ? 'windows' : (/linux|x11/i.test(ua) || /Linux/.test(agent)) && !/Android/.test(agent) ? 'linux' : '';
  if (os) {
    $$('.dl[data-os="' + os + '"]').forEach(function (el) { el.classList.add('mine'); });
    $$('[data-cta-os]').forEach(function (el) {
      var label = el.dataset['cta' + os.charAt(0).toUpperCase() + os.slice(1)];
      if (label) el.textContent = label;
    });
  }

  /* dernière version publiée (facultatif : les liens fixes marchent sans) */
  var holder = $('[data-release]');
  if (holder && 'fetch' in window) {
    var API = holder.dataset.release;
    var safe = function (u) { return /^https:\/\/github\.com\/faelnor92\/regiewave\//.test(u); };
    var fmt = function (n) { return (n / 1048576).toFixed(0) + ' Mo'; };
    var size = function (n) { return holder.lang === 'en' ? (n / 1048576).toFixed(0) + ' MB' : fmt(n); };
    fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (rel) {
      $$('[data-release-version]').forEach(function (el) { el.textContent = (rel.name || rel.tag_name); });
      (rel.assets || []).forEach(function (a) {
        var kind = /\.exe$/i.test(a.name) ? 'windows' : /\.appimage$/i.test(a.name) ? 'linux' : '';
        if (!kind || !safe(a.browser_download_url)) return;
        $$('[data-asset="' + kind + '"]').forEach(function (box) {
          var link = $('[data-asset-link]', box); if (link) link.href = a.browser_download_url;
          var f = $('[data-asset-file]', box); if (f) f.textContent = a.name;
          var s = $('[data-asset-size]', box); if (s) s.textContent = size(a.size);
          if (a.digest && /^sha256:[0-9a-f]{64}$/.test(a.digest)) {
            var h = $('[data-asset-hash]', box), c = $('[data-copy]', box);
            if (h) h.textContent = a.digest.slice(7);
            if (c) c.dataset.copy = a.digest.slice(7);
          }
          box.classList.add('ready');
        });
      });
    }).catch(function () { /* les liens vers « dernière version » restent valables */ });
  }
})();
