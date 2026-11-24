/* Manuel de RegieWave : recherche, sommaire qui suit la lecture, copie du code.
   La recherche réutilise celle de la mascotte (assistant.js) : rien n'est envoyé à personne. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var api = window.RW_ASSISTANT_API;
  var input = $('#m-q'), box = $('#m-results');

  /* recherche */
  if (input && box && api && api.searchManual) {
    var timer = 0, current = 0;
    var hide = function () { box.hidden = true; box.textContent = ''; };
    var short = function (p) { return p.split(/\s[:–—]\s/)[0]; };
    var render = function (found, q) {
      box.textContent = '';
      if (!found.length) {
        var none = document.createElement('div');
        none.className = 'm-none';
        none.textContent = 'Rien trouvé pour « ' + q + ' ». Essayez d’autres mots, ou demandez à la mascotte.';
        box.appendChild(none); box.hidden = false; return;
      }
      found.forEach(function (f) {
        var a = document.createElement('a'), t = document.createElement('strong'), p = document.createElement('small'), e = document.createElement('span');
        a.href = f.c.u; a.setAttribute('role', 'option');
        t.textContent = f.c.t; p.textContent = short(f.c.p); e.textContent = f.c.e;
        a.appendChild(p); a.appendChild(t); a.appendChild(e);
        box.appendChild(a);
      });
      box.hidden = false;
    };
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(function () {
        var asked = q;
        api.searchManual(q, 8).then(function (found) { if (input.value.trim() === asked) render(found, asked); });
      }, 130);
    });
    input.addEventListener('focus', function () { api.searchManual('x', 1); }); // charge l'index à l'avance
    input.addEventListener('keydown', function (e) {
      var items = $$('a', box);
      if (e.key === 'Escape') { input.value = ''; hide(); }
      else if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); current = 0; items[0].focus(); }
      else if (e.key === 'Enter' && items.length) { location.href = items[0].href; }
    });
    box.addEventListener('keydown', function (e) {
      var items = $$('a', box), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) input.focus(); else items[i - 1].focus(); }
      else if (e.key === 'Escape') { hide(); input.focus(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.m-search')) hide(); });
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  /* menu des pages replié sur petit écran */
  var pages = $('.m-pages');
  if (pages && window.innerWidth < 960) pages.removeAttribute('open');

  /* sommaire de la page : la section lue est mise en valeur */
  var links = $$('.m-toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var heads = $$('.manual h2[id], .manual h3[id]');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || !byId[en.target.id]) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        byId[en.target.id].classList.add('on');
        byId[en.target.id].scrollIntoView({ block: 'nearest' });
      });
    }, { rootMargin: '-12% 0px -78% 0px' });
    heads.forEach(function (h) { spy.observe(h); });
  }

  /* copier un bloc de code */
  $$('.manual pre').forEach(function (pre) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = 'Copier';
    b.addEventListener('click', function () {
      var text = pre.querySelector('code').textContent;
      var done = function () { b.textContent = 'Copié'; setTimeout(function () { b.textContent = 'Copier'; }, 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () {});
    });
    pre.appendChild(b);
  });

  /* la section visée par un lien est brièvement mise en évidence */
  var flash = function () {
    if (!location.hash || location.hash === '#assistant' || location.hash === '#visite') return;
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
  };
  flash();
  window.addEventListener('hashchange', flash);
})();
