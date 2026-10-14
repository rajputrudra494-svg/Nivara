/* =========================================================
   Nivara — interactions & motion
   GSAP + ScrollTrigger + Lenis (loaded from CDN in index.html)
   ========================================================= */
(function () {
  'use strict';

  /* Where the contact form posts to (e.g. a Formspree / Getform URL or your own API).
     Leave empty until it's wired up; the form will say so instead of pretending to send. */
  var FORM_ENDPOINT = '';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { return t * t * (3 - 2 * t); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var body = document.body;
  var loader = $('.loader');
  var nav = $('.nav');

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  $$('.js-year').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- graceful fallback if the animation libraries didn't load ---------- */
  if (!window.gsap || !window.ScrollTrigger) {
    body.classList.add('no-gsap');
    body.classList.remove('is-loading');
    if (loader) loader.remove();
    setupMenu(null);
    setupDecay(null);
    setupForm(null);
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  // One broken feature must never take the rest of the page (or the loader) down with it.
  function safe(fn) {
    try { return fn.apply(null, Array.prototype.slice.call(arguments, 1)); }
    catch (err) { console.error('[Nivara]', fn.name, err); return null; }
  }

  var menu = safe(setupMenu, lenis);
  safe(setupAnchors);
  safe(setupCursor);
  safe(setupMagnetic);
  safe(setupTilt);
  safe(setupMarquee);
  var revealHero = safe(setupIntro) || { done: true };
  // Pinned sections first: ScrollTrigger measures in creation order, so every
  // trigger further down the page must be created after the pins exist.
  var scene = safe(setupScene);
  if (scene) {
    safe(setupProcess, scene);
    safe(setupApps);
    safe(scene.late);
  } else {
    safe(setupApps);
  }
  safe(setupNav);
  safe(setupHeadings);
  safe(setupReveals);
  safe(setupCounters);
  safe(setupDecay, gsap);
  safe(setupCompare);
  safe(setupFooter);
  safe(setupForm, gsap);

  /* =========================================================
     Intro / loader
     ========================================================= */
  function setupIntro() {
    gsap.set('.hero__title .line__in', { yPercent: 115 });
    gsap.set('.hero-fade', { autoAlpha: 0, y: 24 });
    gsap.set(nav, { autoAlpha: 0 });

    var countEl = $('.js-count');
    var counter = { v: 0 };
    var intro = gsap.timeline();
    intro
      .fromTo('.loader__word span', { yPercent: 105 }, { yPercent: 0, stagger: 0.05, duration: 0.9, ease: 'power4.out' }, 0)
      .to(counter, {
        v: 100, duration: reduced ? 0.4 : 1.6, ease: 'power2.inOut',
        onUpdate: function () { countEl.textContent = Math.round(counter.v); }
      }, 0)
      .to('.loader__bar span', { scaleX: 1, duration: reduced ? 0.4 : 1.6, ease: 'power2.inOut' }, 0);

    var introDone = new Promise(function (res) { intro.eventCallback('onComplete', res); });
    var fontsDone = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var sceneDone = window.VScene ? window.VScene.ready : Promise.resolve();
    var timeout = new Promise(function (res) { setTimeout(res, 3800); });

    Promise.all([introDone, Promise.race([Promise.all([fontsDone, sceneDone]), timeout])]).then(reveal);

    var revealed = { done: false };
    function reveal() {
      ScrollTrigger.refresh();
      var out = gsap.timeline({ onComplete: function () { if (loader) loader.remove(); } });
      out
        .to('.loader__word span', { yPercent: -105, stagger: 0.03, duration: 0.6, ease: 'power3.in' })
        .to('.loader__count, .loader__mark, .loader__bar', { autoAlpha: 0, duration: 0.4 }, '<')
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, '-=0.15')
        .add(function () {
          body.classList.remove('is-loading');
          if (lenis) lenis.start();
          revealed.done = true;
        }, '-=0.7')
        .to('.hero__title .line__in', { yPercent: 0, stagger: 0.1, duration: 1.3, ease: 'expo.out' }, '-=0.6')
        .to('.hero-fade', { autoAlpha: 1, y: 0, stagger: 0.1, duration: 1, ease: 'power3.out' }, '-=1.05')
        .to(nav, { autoAlpha: 1, duration: 0.8 }, '<');
    }

    // hero drifts away as you scroll
    if (!reduced) {
      gsap.to('.hero__title', {
        yPercent: -14, autoAlpha: 0.15, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
      gsap.to('.hero__bottom', {
        y: -60, autoAlpha: 0, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: '20% top', end: '80% top', scrub: true }
      });
    }
    return revealed;
  }

  /* =========================================================
     3D scene choreography
     ========================================================= */
  function setupScene() {
    var S = window.VScene ? window.VScene.target : null;
    var stHero = ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top' });
    var stEnter = ScrollTrigger.create({ trigger: '.process', start: 'top bottom', end: 'top top' });
    var state = { pinProgress: 0, pin: null };

    function layout() {
      var small = window.innerWidth < 900;
      return {
        heroX: small ? 0 : 0.42, heroY: small ? 0.3 : 0.04, heroS: small ? 0.62 : 1,
        procX: small ? 0 : 0.44, procY: small ? 0.36 : 0, procS: small ? 0.6 : 1.02,
        contactX: small ? 0 : 0.5, contactS: small ? 0.7 : 0.95
      };
    }

    // created after the process pin so their positions include its spacer
    var stLeave, stContact, stFooter;
    state.late = function () {
      stLeave = ScrollTrigger.create({ trigger: '.compare', start: 'top bottom', end: 'top 35%' });
      stContact = ScrollTrigger.create({ trigger: '.contact', start: 'top bottom', end: 'center center' });
      stFooter = ScrollTrigger.create({ trigger: '.footer', start: 'top 70%', end: 'top 20%' });
    };

    state.pinMorph = function (p) {
      var segs = clamp(p, 0, 0.9999) * 5;
      var i = Math.floor(segs), local = segs - i;
      var e = i < 4 ? smooth(clamp((local - 0.5) / 0.42, 0, 1)) : 0;
      return 1 + i + e;
    };

    gsap.ticker.add(function () {
      if (!S || !revealHero.done) return;
      var L = layout();
      var hp = stHero.progress, pe = stEnter.progress;
      var pin = state.pin;
      var afterPin = pin && pin.progress >= 1;
      var inPin = pin && pin.isActive;
      var m, o, x, y, s;

      if (!inPin && !afterPin) {
        m = pe;
        o = lerp(1 - hp * 0.75, 1, pe);
        x = lerp(L.heroX, L.procX, pe);
        y = lerp(L.heroY, L.procY, pe);
        s = lerp(L.heroS * (1 + hp * 0.25), L.procS, pe);
      } else if (inPin) {
        m = state.pinMorph(pin.progress);
        o = 1; x = L.procX; y = L.procY; s = L.procS;
      } else {
        var pl = stLeave ? stLeave.progress : 1;
        var ce = stContact ? stContact.progress : 0;
        var fl = stFooter ? stFooter.progress : 0;
        m = 5;
        o = Math.max(1 - pl, ce * 0.55) * (1 - fl);
        x = lerp(L.procX, L.contactX, ce);
        y = lerp(L.procY, 0, ce);
        s = lerp(L.procS, L.contactS, ce);
      }
      S.morph = m; S.opacity = o; S.x = x; S.y = y; S.scale = s;
    });

    return state;
  }

  /* =========================================================
     Process: pinned 5-step story
     ========================================================= */
  function setupProcess(scene) {
    var steps = $$('.step');
    var bars = $$('.process__progress span');
    var active = 0;
    gsap.set(steps, { autoAlpha: 0 });
    gsap.set(steps[0], { autoAlpha: 1 });

    function setStep(i) {
      if (i === active) return;
      var prev = steps[active], next = steps[i];
      var dir = i > active ? 1 : -1;
      steps.forEach(function (s, k) { if (k !== i && k !== active) { gsap.killTweensOf(s); gsap.set(s, { autoAlpha: 0 }); } });
      active = i;
      gsap.killTweensOf([prev, next]);
      gsap.to(prev, { autoAlpha: 0, y: -28 * dir, duration: 0.4, ease: 'power2.in' });
      gsap.fromTo(next, { autoAlpha: 0, y: 36 * dir }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.12 });
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    }

    scene.pin = ScrollTrigger.create({
      trigger: '.process',
      start: 'top top',
      end: function () { return '+=' + window.innerHeight * (window.innerWidth < 900 ? 3.6 : 4.5); },
      pin: true,
      anticipatePin: 1,
      onUpdate: function (self) {
        var p = self.progress;
        var m = scene.pinMorph(p);
        setStep(clamp(Math.round(m - 1), 0, 4));
        bars.forEach(function (b, k) { b.style.setProperty('--fill', clamp(p * 5 - k, 0, 1)); });
      }
    });
  }

  /* =========================================================
     Nav, menu, anchors
     ========================================================= */
  function setupNav() {
    var lastY = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 30);
      if (!body.classList.contains('menu-open') && Math.abs(y - lastY) > 4) {
        nav.classList.toggle('is-hidden', y > lastY && y > 500);
      }
      lastY = y;
    }, { passive: true });

    // onToggle can fire during create(), so the list must exist before the first trigger does
    var lights = [];
    var syncLight = function () { nav.classList.toggle('is-light', lights.some(function (s) { return s.isActive; })); };
    $$('.light').forEach(function (sec) {
      lights.push(ScrollTrigger.create({ trigger: sec, start: 'top 40px', end: 'bottom 40px', onToggle: syncLight }));
    });
    syncLight();

    $$('.nav__links a').forEach(function (a) {
      var sec = $(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (self) { a.classList.toggle('is-active', self.isActive); }
      });
    });
  }

  function setupMenu(lenis) {
    var burger = $('.nav__burger');
    var panel = $('.menu');
    if (!burger || !panel) return null;
    var open = false;
    function set(v) {
      open = v;
      body.classList.toggle('menu-open', v);
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      panel.setAttribute('aria-hidden', String(!v));
      nav.classList.remove('is-hidden');
      if (lenis) { if (v) lenis.stop(); else lenis.start(); }
    }
    burger.addEventListener('click', function () { set(!open); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) set(false); });
    return { close: function () { if (open) set(false); } };
  }

  function setupAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        var dest = id === '#top' ? 0 : (id.length > 1 ? $(id) : null);
        if (dest === null) return;
        e.preventDefault();
        if (menu) menu.close();
        if (lenis) lenis.scrollTo(dest, { duration: 1.6 });
        else if (dest === 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        else dest.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* =========================================================
     Cursor, magnetic buttons, tilt cards
     ========================================================= */
  function setupCursor() {
    var cur = $('.cursor');
    if (!cur || touch) return;
    var dot = $('.cursor__dot'), ring = $('.cursor__ring');
    var mx = -100, my = -100, rx = -100, ry = -100;
    cur.classList.add('is-hidden');
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      cur.classList.remove('is-hidden');
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { cur.classList.add('is-hidden'); });
    document.addEventListener('pointerover', function (e) {
      cur.classList.toggle('is-hover', !!e.target.closest('a, button, label, .decay__range'));
    });
    window.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    window.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
    gsap.ticker.add(function () {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    });
  }

  function setupMagnetic() {
    if (touch || reduced) return;
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: x * 0.28, y: y * 0.38, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  function setupTilt() {
    if (touch || reduced) return;
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        gsap.to(el, { rotationY: (px - 0.5) * 9, rotationX: (0.5 - py) * 9, transformPerspective: 900, duration: 0.6, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)' });
      });
    });
  }

  /* =========================================================
     Marquee — speed & direction follow scroll velocity
     ========================================================= */
  function setupMarquee() {
    var track = $('.marquee__track'), group = $('.marquee__group');
    if (!track || !group || reduced) return;
    track.appendChild(group.cloneNode(true));
    var pos = 0, dir = 1, w = group.offsetWidth;
    window.addEventListener('resize', function () { w = group.offsetWidth; });
    gsap.ticker.add(function (time, dtMs) {
      var v = lenis ? lenis.velocity : 0;
      if (Math.abs(v) > 0.5) dir = v > 0 ? 1 : -1;
      var speed = 70 * (1 + Math.min(Math.abs(v) * 0.12, 5));
      pos -= dir * speed * (dtMs / 1000);
      if (pos <= -w) pos += w;
      if (pos > 0) pos -= w;
      track.style.transform = 'translate3d(' + pos.toFixed(2) + 'px,0,0)';
    });
  }

  /* =========================================================
     Text reveals
     ========================================================= */
  function splitWords(el) {
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var inner = document.createElement('span'); inner.className = 'w__in'; inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    return $$('.w__in', el);
  }

  function setupHeadings() {
    $$('.split-words').forEach(function (el) {
      var words = splitWords(el);
      if (reduced) return;
      gsap.from(words, {
        yPercent: 115, rotate: 4, duration: 1.15, ease: 'expo.out', stagger: 0.045,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });
  }

  function setupReveals() {
    if (reduced) return;
    $$('.reveal-up').forEach(function (el) {
      gsap.from(el, { y: 44, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    [['.stats', '.stat'], ['.pillars', '.pillar'], ['.cards3', '.acard'], ['.team__grid', '.member']].forEach(function (pair) {
      var wrap = $(pair[0]);
      if (!wrap) return;
      gsap.from($$(pair[1], wrap), {
        y: 70, autoAlpha: 0, duration: 1.2, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: wrap, start: 'top 85%', once: true }
      });
    });
    // light sections rise in like cards
    $$('.light').forEach(function (sec) {
      gsap.fromTo(sec, { scale: 0.94 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 25%', scrub: true }
      });
    });
    gsap.from('.decay', {
      y: 80, autoAlpha: 0, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: '.decay', start: 'top 85%', once: true }
    });
  }

  function setupCounters() {
    $$('.count').forEach(function (el) {
      var to = parseFloat(el.dataset.to) || 0;
      var o = { v: 0 };
      if (reduced) { el.textContent = to; return; }
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () {
          gsap.to(o, { v: to, duration: 2.2, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
        }
      });
    });
  }

  /* =========================================================
     Decomposition time-machine
     ========================================================= */
  function setupDecay(g) {
    var range = $('.decay__range');
    if (!range) return;
    var NS = 'http://www.w3.org/2000/svg';
    var yearsEl = $('.js-years'), plasticState = $('.js-plastic-state'), phaState = $('.js-pha-state');
    var plasticBody = $('.decay__item--plastic .bottle__body');
    var phaBody = $('.decay__item--pha .bottle__body');
    var clip = $('.pha-clip');
    var sprout = $('.decay__item--pha .sprout');
    var fragsG = $('.decay__item--plastic .frags'), crumbsG = $('.decay__item--pha .crumbs');

    // plastic shards that break off over the centuries (and never go away)
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var shards = [];
    for (var i = 0; i < 48; i++) {
      var s = 1.4 + rnd() * 3.6;
      var poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', [0, -s, s * 0.9, s * 0.6, -s * 0.8, s * 0.7].join(' '));
      fragsG.appendChild(poly);
      var cx = 34 + rnd() * 52, cy = 30 + rnd() * 178;
      shards.push({ el: poly, cx: cx, cy: cy, fx: clamp(cx + (rnd() - 0.5) * 90, 4, 116), fy: Math.min(213, cy + 20 + rnd() * 90), rot: rnd() * 360, th: rnd() });
    }
    shards.sort(function (a, b) { return a.th - b.th; });
    var crumbs = [];
    for (var j = 0; j < 26; j++) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (30 + rnd() * 60).toFixed(1));
      c.setAttribute('cy', (176 + rnd() * 38).toFixed(1));
      c.setAttribute('r', (0.8 + rnd() * 1.8).toFixed(1));
      crumbsG.appendChild(c);
      crumbs.push({ el: c, k: rnd() });
    }

    function toYears(v) {
      if (v <= 250) return v / 250;
      if (v <= 500) return Math.pow(10, (v - 250) / 250);
      if (v <= 750) return Math.pow(10, 1 + (v - 500) / 250);
      return 100 * Math.pow(5, (v - 750) / 250);
    }
    function label(y) {
      if (y < 1 / 12) return 'Day ' + Math.round(y * 365);
      if (y < 0.99) { var mo = Math.max(1, Math.round(y * 12)); return mo + (mo === 1 ? ' month' : ' months'); }
      if (y < 9.95) { var r = Math.round(y * 10) / 10; return r + (r === 1 ? ' year' : ' years'); }
      return Math.round(y) + ' years';
    }

    function update() {
      var v = +range.value, y = toYears(v);
      range.style.setProperty('--p', (v / 10) + '%');
      range.setAttribute('aria-valuetext', label(y));
      yearsEl.textContent = label(y);

      // PHA: under active compost / marine conditions it is designed to be gone in about a year
      var d = clamp(y / 1.05, 0, 1), de = smooth(d);
      clip.setAttribute('y', (de * 212).toFixed(1));
      phaBody.style.opacity = (1 - de * 0.35).toFixed(3);
      crumbs.forEach(function (cr) { cr.el.style.opacity = (Math.sin(d * Math.PI) * (0.4 + cr.k * 0.6)).toFixed(3); });
      var sp = smooth(clamp((d - 0.55) / 0.45, 0, 1));
      sprout.style.transform = 'scale(' + sp.toFixed(3) + ')';
      phaState.textContent = d <= 0 ? 'Intact' : d < 0.25 ? 'Microbes moving in' : d < 0.7 ? 'Breaking down' : d < 1 ? 'Almost gone' : 'Back to CO₂, water & biomass';

      // conventional plastic: barely changes, then sheds microplastics
      var f = y < 15 ? 0 : clamp(Math.log(y / 15) / Math.log(500 / 15), 0, 1);
      plasticBody.style.opacity = (1 - f * 0.4).toFixed(3);
      shards.forEach(function (sh) {
        var on = clamp((f - sh.th * 0.85) / 0.15, 0, 1);
        var px = lerp(sh.cx, sh.fx, on * f), py = lerp(sh.cy, sh.fy, on * f);
        sh.el.setAttribute('transform', 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ') rotate(' + (sh.rot + on * 90).toFixed(0) + ')');
        sh.el.style.opacity = (on * 0.85).toFixed(3);
      });
      plasticState.textContent = y < 1 ? 'Intact' : y < 20 ? 'Still intact' : y < 150 ? 'Brittle, shedding fragments' : 'Microplastics. Still here.';
    }

    var touched = false;
    range.addEventListener('input', function () { touched = true; update(); });
    update();

    // a gentle demo the first time it scrolls into view
    if (g && !reduced) {
      var proxy = { v: 0 };
      ScrollTrigger.create({
        trigger: '.decay', start: 'top 55%', once: true,
        onEnter: function () {
          g.to(proxy, {
            v: 300, duration: 2.6, ease: 'power2.inOut', delay: 0.4,
            onUpdate: function () { if (touched) return; range.value = proxy.v; update(); }
          });
        }
      });
    }
  }

  /* =========================================================
     Comparison table
     ========================================================= */
  function setupCompare() {
    var rows = $$('.table__row');
    if (reduced) { rows.forEach(function (r) { r.classList.add('in'); }); return; }
    gsap.set(rows, { autoAlpha: 0, y: 30 });
    ScrollTrigger.batch(rows, {
      start: 'top 90%', once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
          onStart: function () { batch.forEach(function (r, i) { setTimeout(function () { r.classList.add('in'); }, 200 + i * 100); }); }
        });
      }
    });
  }

  /* =========================================================
     Applications — horizontal scroll on desktop
     ========================================================= */
  function setupApps() {
    var track = $('.apps__track');
    if (!track) return;
    var cards = $$('.app', track);

    function prepDraw(card) {
      return $$('.draw > *', card).map(function (el) {
        var len = el.getTotalLength ? el.getTotalLength() : 400;
        el.style.strokeDasharray = len;
        el.style.strokeDashoffset = reduced ? 0 : len;
        return el;
      });
    }
    function draw(paths) {
      gsap.to(paths, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.12 });
    }
    var drawn = cards.map(prepDraw);
    if (reduced) return;

    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: '.apps', start: 'top top',
          end: function () { return '+=' + dist(); },
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1
        }
      });
      cards.forEach(function (card, i) {
        ScrollTrigger.create({
          trigger: card, containerAnimation: tween, start: 'left 88%', once: true,
          onEnter: function () { draw(drawn[i]); }
        });
      });
    });
    mm.add('(max-width: 900px)', function () {
      ScrollTrigger.create({
        trigger: track, start: 'top 85%', once: true,
        onEnter: function () { drawn.forEach(draw); }
      });
    });
  }

  /* =========================================================
     Footer
     ========================================================= */
  function setupFooter() {
    if (reduced) return;
    gsap.from('.footer__word span', {
      yPercent: 100, duration: 1.3, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: '.footer__word', start: 'top 95%', once: true }
    });
  }

  /* =========================================================
     Contact form
     ========================================================= */
  function setupForm(g) {
    var form = $('.form');
    if (!form) return;
    var status = $('.form__status', form);
    var btnLabel = $('button[type="submit"] span', form);

    function invalid(field, bad) { field.closest('.field').classList.toggle('is-invalid', bad); return bad; }
    $$('input, textarea', form).forEach(function (el) {
      el.addEventListener('input', function () { el.closest('.field') && el.closest('.field').classList.remove('is-invalid'); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name, email = form.elements.email;
      var bad = invalid(name, !name.value.trim());
      bad = invalid(email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) || bad;
      status.classList.remove('is-error');
      if (bad) {
        status.textContent = 'Please add your name and a valid email.';
        status.classList.add('is-error');
        if (g && !reduced) g.fromTo(form, { x: -10 }, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
        return;
      }

      if (!FORM_ENDPOINT) {
        status.textContent = 'The form isn’t connected yet. Set FORM_ENDPOINT in assets/js/main.js.';
        status.classList.add('is-error');
        return;
      }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      btnLabel.textContent = 'Sending…';
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        btnLabel.textContent = 'Sent';
        status.textContent = 'Thanks, ' + data.name.split(' ')[0] + '. We’ll be in touch soon.';
        form.reset();
      }).catch(function () {
        btnLabel.textContent = 'Send message';
        status.textContent = 'Something went wrong. Please try again.';
        status.classList.add('is-error');
      });
    });
  }
})();
