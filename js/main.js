/* Schedule Lesson — site script.
   Works in three modes:
   - cine: GSAP + ScrollTrigger (+ Lenis) loaded and motion allowed → pinned scroll cinema;
   - static with JS: libraries blocked or prefers-reduced-motion → final-state layout, i18n, App Store state, carousel;
   - no JS at all: final-state layout in Ukrainian (see index.html / css). */
(() => {
  'use strict';

  const D = window.SL_I18N || {};
  const LANGS = ['uk', 'ru', 'en', 'pl', 'de', 'fr', 'es', 'it'];
  const PAGE = { uk: '', ru: 'ru.html', en: 'en.html', pl: 'pl.html', de: 'de.html', fr: 'fr.html', es: 'es.html', it: 'it.html' };
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const STACK_MQ = matchMedia('(max-width: 899px), (max-aspect-ratio: 21/20)');
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  // short landscape phones get the static layout (the pinned cinema needs height)
  const LAND_MQ = matchMedia('(max-height: 500px) and (orientation: landscape)');
  if (RM.matches) html.classList.add('no-anim');

  /* ============================== i18n ============================== */
  function detectLang() {
    if (LANGS.includes(window.SL_LANG)) return window.SL_LANG; // decided in the <head> script
    let q = null, s = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
    if (q && LANGS.includes(q)) return q;
    try { s = localStorage.getItem('sl_lang'); } catch (e) { /* storage blocked */ }
    if (s && LANGS.includes(s)) return s;
    // the first supported language in the browser's list; any other language → English
    const ns = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const n of ns) { const c = String(n || '').toLowerCase().slice(0, 2); if (LANGS.includes(c)) return c; }
    return 'en';
  }
  let lang = detectLang();
  const t = (k, l = lang) => (D[l] && D[l][k] != null ? D[l][k] : (D.uk && D.uk[k] != null ? D.uk[k] : ''));
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));

  // typography (keep in sync with _build/prerender.mjs): no line-start dashes; glue currency to the amount;
  // glue one-letter words to the next word (uk/ru, pl); French spacing before : ; ! ? » and after «
  const NB = '\u00a0';
  const CYR1 = /(^|[\s(«"„])([вуійзаоиксяВУІЙЗАОИКСЯ])\s(?=\S)/g;
  const ONE = { uk: CYR1, ru: CYR1, pl: /(^|[\s(„"])([aiouwzAIOUWZ])\s(?=\S)/g };
  const ONE_CH = { uk: 'вуійзаоиксяВУІЙЗАОИКСЯ', ru: 'вуійзаоиксяВУІЙЗАОИКСЯ', pl: 'aiouwzAIOUWZ' };
  function typoText(v, l) {
    let r = v.replace(/ (—|–|→)/g, NB + '$1')
      .replace(/(\d) (?=\d{3}(?!\d))/g, '$1' + NB) // 2 100
      .replace(/ (₴|€|zł)/g, NB + '$1');
    const re = ONE[l];
    if (re) r = r.replace(re, '$1$2' + NB).replace(re, '$1$2' + NB);
    if (l === 'fr') r = r.replace(/ ([:;!?»])/g, NB + '$1').replace(/« /g, '«' + NB);
    return r;
  }
  function typo(v, l = lang, isHtml = false) {
    if (!v) return v;
    if (!isHtml) return typoText(v, l);
    if (ONE_CH[l]) v = v.replace(new RegExp('(^|[\\s(«"„>])([' + ONE_CH[l] + ']) (?=<[a-z])', 'g'), '$1$2' + NB); // "і <em>…": one-letter word before an inline tag
    return v.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => (tag || typoText(txt, l)));
  }
  const TAGS = { g: 'gt', m: 'gt-m', d: 'dim-txt' };
  const rich = v => v.replace(/<(\/?)([gmd])>/g, (m, c, tag) => (c ? '</span>' : `<span class="${TAGS[tag]}">`));
  const linesHTML = v => v.split('|').map(line => `<span class="ln"><span>${rich(typo(line, lang, true))}</span></span>`).join(' ');
  function wordsHTML(v) {
    const tmp = document.createElement('div');
    tmp.innerHTML = rich(typo(v, lang, true));
    const walk = (node, cls) => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/( +)/).forEach(p => {
            if (!p) return;
            if (/^ +$/.test(p)) { frag.append(document.createTextNode(p)); return; }
            const s = document.createElement('span');
            s.className = 'w' + (cls ? ' ' + cls : '');
            s.textContent = p;
            frag.append(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) {
          const c = ch.classList.contains('gt') ? 'gt' : ch.classList.contains('gt-m') ? 'gt-m' : '';
          if (c) { walk(ch, c); ch.replaceWith(...Array.from(ch.childNodes)); } else walk(ch, cls);
        }
      });
    };
    walk(tmp, '');
    return tmp.innerHTML;
  }
  // demo amounts in each language's demo currency, grouped like the app's statistics screen (1.625 € / 1543 € / 4070 zł)
  const CUR = { pl: ['pl-PL', 'PLN'], de: ['de-DE', 'EUR'], fr: ['fr-FR', 'EUR'], es: ['es-ES', 'EUR'], it: ['it-IT', 'EUR'] };
  function fmtMoney(v, l = lang) {
    if (l === 'en') return '$' + Number(v).toLocaleString('en-US');
    if (CUR[l]) {
      try {
        return new Intl.NumberFormat(CUR[l][0], { style: 'currency', currency: CUR[l][1], maximumFractionDigits: 0, minimumFractionDigits: 0, useGrouping: l === 'de' ? 'auto' : 'min2' })
          .format(Number(v)).replace(/[\s\u202f]/g, NB);
      } catch (e) { return Number(v) + NB + CUR[l][1]; }
    }
    return Number(v).toLocaleString('uk-UA').replace(/\s/g, NB) + NB + '₴';
  }
  // data-money holds an i18n key with the amount (each language has its own demo currency) or a plain number
  const moneyVal = el => Number(/^\d+$/.test(el.dataset.money) ? el.dataset.money : t(el.dataset.money)) || 0;

  const menu = $('#menu');
  const burger = $('#burger');

  function applyLang(l, { save = false } = {}) {
    lang = LANGS.includes(l) ? l : 'uk';
    html.lang = lang;
    document.title = t('meta.title');
    $$('[data-i18n]').forEach(el => { el.textContent = typo(t(el.dataset.i18n)); });
    $$('[data-i18n-html]').forEach(el => { el.innerHTML = rich(typo(t(el.dataset.i18nHtml), lang, true)); });
    $$('[data-lines]').forEach(el => { el.innerHTML = linesHTML(t(el.dataset.lines)); });
    $$('[data-words]').forEach(el => { el.innerHTML = wordsHTML(t(el.dataset.words)); });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(',').forEach(pair => {
        const [a, k] = pair.split(':').map(s => s.trim());
        const v = t(k);
        el.setAttribute(a, a === 'href' || a === 'content' || a === 'src' ? v : typo(v));
      });
    });
    $$('img[data-shot]').forEach(img => {
      const src = `assets/shots/${lang}/${img.dataset.shot}.jpg`;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
    $$('[data-alt]').forEach(img => { img.alt = typo(t(img.dataset.alt)); });
    $$('[data-alt-shot]').forEach(img => {
      const n = img.dataset.altShot;
      img.alt = typo(fill(t('shot.alt'), { t: t(`g.${n}.t`), d: t(`g.${n}.d`) }));
    });
    const slides = $$('.car-item');
    slides.forEach(li => li.setAttribute('aria-label', fill(t('screens.of'), { n: li.dataset.of, total: slides.length })));
    $$('[data-money]').forEach(el => { el.textContent = fmtMoney(moneyVal(el)); });
    const avs = t('unl.avs').split(',');
    $$('.avs .av:not(.av-more)').forEach((el, i) => { el.textContent = avs[i] || ''; });
    $$('.lang-opt').forEach(a => { if (a.dataset.lang === lang) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (menu && !menu.hidden) burger.setAttribute('aria-label', t('nav.menu.close'));
    if (save) {
      try { localStorage.setItem('sl_lang', lang); } catch (e) { /* ignore */ }
      try { // each language has its own static page: / (uk), ru.html, en.html, pl.html, de.html, fr.html, es.html, it.html
        const u = new URL(location.href);
        u.searchParams.delete('lang');
        u.pathname = u.pathname.replace(/[^/]*$/, '') + PAGE[lang];
        history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      } catch (e) { /* ignore */ }
    }
    if (built) rebuild();
    else if (typeof aiRender === 'function') aiRender(aiP);
    html.classList.remove('sl-i18n'); // set in the <head> script while / still shows the Ukrainian static text
  }

  /* ============================== live countdown ============================== */
  const T0 = 42 * 60 + 51;
  let secs = T0;
  const timers = $$('[data-timer]');
  const fmtT = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  setInterval(() => {
    if (document.hidden) return;
    secs = secs > 0 ? secs - 1 : T0;
    const s = fmtT(secs);
    timers.forEach(el => { el.textContent = s; });
  }, 1000);

  /* ============================== nav ============================== */
  const nav = $('#nav');
  const onNavScroll = () => nav.classList.toggle('scrolled', (window.scrollY || 0) > 24);
  addEventListener('scroll', onNavScroll, { passive: true });
  onNavScroll();

  function setMenu(open, { focus = true } = {}) {
    if (!menu) return;
    menu.hidden = !open;
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'nav.menu.close' : 'nav.menu.open'));
    if (open) {
      if (lenis) lenis.stop();
      if (focus) { const a = menu.querySelector('a'); if (a) a.focus(); }
    } else if (lenis) lenis.start();
  }
  burger.addEventListener('click', () => setMenu(menu.hidden));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); }
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !nav.contains(e.target)) setMenu(false, { focus: false });
  });
  // keyboard focus leaving the open menu closes it (nothing gets focused behind the sheet)
  nav.addEventListener('focusout', e => {
    if (!menu.hidden && e.relatedTarget && !nav.contains(e.relatedTarget)) setMenu(false, { focus: false });
  });

  /* language menu: a disclosure button + a list of real links (one per language page). With JS the switch happens
     in place (no reload) and the URL is updated to the matching page; the links stay usable for crawlers,
     "open in new tab" and middle-click. Keyboard: Enter/Space/↓ opens, ↑/↓/Home/End move, Escape closes. */
  const langBox = $('#lang'), langBtn = $('#langBtn');
  const langItems = () => $$('#langPop .lang-opt');
  function setLangPop(open, { focus = false } = {}) {
    if (!langBox) return;
    langBox.classList.toggle('open', open);
    langBtn.setAttribute('aria-expanded', String(open));
    if (open && focus) { const items = langItems(); (items.find(a => a.dataset.lang === lang) || items[0]).focus(); }
  }
  if (langBox) {
    langBtn.addEventListener('click', e => {
      const open = !langBox.classList.contains('open');
      setLangPop(open, { focus: open && e.detail === 0 }); // keyboard activation moves focus into the list
    });
    langBtn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setLangPop(true, { focus: true }); } // stop: #lang's handler would move focus one more step
    });
    langBox.addEventListener('keydown', e => {
      if (!langBox.classList.contains('open')) return;
      const items = langItems(), i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setLangPop(false); langBtn.focus(); return; }
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowDown') j = (i + 1) % items.length;
      else if (e.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = items.length - 1;
      if (j > -1) { e.preventDefault(); items[j].focus(); }
    });
    langBox.addEventListener('focusout', e => { if (e.relatedTarget && !langBox.contains(e.relatedTarget)) setLangPop(false); });
    document.addEventListener('click', e => { if (!langBox.contains(e.target)) setLangPop(false); });
  }
  $$('.lang-opt').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return; // new tab / window: plain link
    e.preventDefault();
    const l = a.dataset.lang;
    if (langBox && langBox.contains(a)) { setLangPop(false); langBtn.focus(); }
    else if (!menu.hidden) { setMenu(false, { focus: false }); burger.focus(); }
    if (l !== lang) applyLang(l, { save: true });
  }));

  /* ============================== scrolling helpers ============================== */
  let lenis = null;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const absTop = el => el.getBoundingClientRect().top + (window.scrollY || 0);
  function waitScrollEnd(cb) {
    let last = -1, still = 0;
    const t0 = performance.now();
    const tick = () => {
      const y = window.scrollY;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still > 5 || performance.now() - t0 > 1800) cb(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function scrollToY(y, done) {
    y = clamp(Math.round(y), 0, maxScroll());
    const dist = Math.abs(y - (window.scrollY || 0));
    if (lenis) {
      if (dist < 4) { if (done) done(); return; }
      lenis.scrollTo(y, { duration: clamp(dist / 2600, 0.7, 1.8), onComplete: () => done && done() });
    } else {
      window.scrollTo({ top: y, behavior: RM.matches ? 'auto' : 'smooth' });
      if (done) waitScrollEnd(done);
    }
  }

  // the hero copy (App Store block, links) becomes visible part-way through the pinned hero; set by the cinema
  let heroSide = null; // { st, frac } from the hero timeline
  const heroSideYNow = () => (heroSide ? heroSide.st.start + (heroSide.st.end - heroSide.st.start) * heroSide.frac : null);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false, { focus: false });
    const y = id === 'top' || id === 'main' ? 0 : absTop(el);
    scrollToY(y, () => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  });

  /* ============================== App Store state ============================== */
  // NOT LIVE is the static default (markup, no-JS, errors): a calm «Скоро в App Store» pill, no download link anywhere;
  // [data-cta] (nav / menu) scroll to the final section (#join).
  // LIVE = html.sl-live: the official badge + pricing buttons link to the store, nav CTA opens it, QR on desktop,
  // «Вже в App Store». What is shown for each state is pure CSS (.st-soon / .st-live).
  // Detection: the public iTunes lookup API (CORS *) — resultCount > 0 means the app is on the store. 4 s timeout;
  // the answer is cached in sessionStorage ('sl_store' = "1 <url>" | "0") for the session and read by the <head>
  // script before first paint. Any failure → stay NOT LIVE silently and retry on the next page load.
  // QA override (never cached): ?live=1 forces LIVE, ?live=0 forces NOT LIVE.
  // RELEASE DAY: re-run the prerender with STORE_LIVE=1 → <html class="sl-live" data-store="released">: LIVE becomes the
  // static default (no-JS, crawlers) and the lookup is skipped, so a blocked/slow itunes.apple.com can no longer hide the store.
  const APP_ID = '6817674096';
  const STORE_URL = `https://apps.apple.com/app/id${APP_ID}`;
  const LOOKUP_URL = `https://itunes.apple.com/lookup?id=${APP_ID}&country=us`;
  const STORE_KEY = 'sl_store';
  function setLive(live, url) {
    const was = html.classList.contains('sl-live');
    html.classList.toggle('sl-live', live);
    const href = live && /^https:\/\/apps\.apple\.com\//.test(url || '') ? url : STORE_URL;
    $$('[data-store-href]').forEach(a => { a.href = href; });
    $$('[data-cta]').forEach(a => { a.setAttribute('href', live ? href : '#join'); });
    if (was !== live && built && window.ScrollTrigger) ScrollTrigger.refresh();
  }
  async function detectStore() {
    let q = null, cached = null;
    try { q = new URLSearchParams(location.search).get('live'); } catch (e) { /* ignore */ }
    if (q === '1' || q === '0') { setLive(q === '1'); return; }
    if (html.getAttribute('data-store') === 'released') { setLive(true); return; }
    try { cached = sessionStorage.getItem(STORE_KEY); } catch (e) { /* storage blocked */ }
    if (cached) { setLive(cached.charAt(0) === '1', cached.slice(2)); return; }
    if (!window.fetch) return;
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : 0;
    try {
      const res = await fetch(LOOKUP_URL, { credentials: 'omit', signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) return;
      const j = await res.json();
      const live = !!(j && j.resultCount > 0);
      const url = (live && j.results && j.results[0] && j.results[0].trackViewUrl) || '';
      try { sessionStorage.setItem(STORE_KEY, live ? '1 ' + url : '0'); } catch (e) { /* ignore */ }
      setLive(live, url);
    } catch (e) { /* offline, blocked or timed out → stay NOT LIVE */ } finally { clearTimeout(timer); }
  }

  /* ============================== carousel ============================== */
  const car = $('#car');
  let carUpd = () => {};
  const carBtns = $$('.car-btn');
  if (car) {
    const gap = () => parseFloat(getComputedStyle(car).columnGap) || 20;
    const items = $$('.car-item', car);
    const snapPoints = () => {
      const pad = parseFloat(getComputedStyle(car).paddingLeft) || 0;
      return items.map(it => clamp(it.offsetLeft - pad, 0, car.scrollWidth - car.clientWidth));
    };
    const prog = $('.car-prog i');
    // aria-disabled (not disabled) so a focused arrow never drops keyboard focus to <body>
    const upd = () => {
      const max = car.scrollWidth - car.clientWidth;
      carBtns.forEach(b => b.setAttribute('aria-disabled', String(+b.dataset.dir < 0 ? car.scrollLeft <= 2 : car.scrollLeft >= max - 2)));
      if (prog) {
        const pw = clamp(car.clientWidth / Math.max(1, car.scrollWidth), 0.08, 1);
        const k = max > 0 ? clamp(car.scrollLeft / max, 0, 1) : 0;
        prog.style.setProperty('--pw', (pw * 100).toFixed(2) + '%');
        prog.style.setProperty('--px', (k * (1 / pw - 1) * 100).toFixed(2) + '%');
      }
    };
    carUpd = upd;
    let rq = 0;
    car.addEventListener('scroll', () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; upd(); }); }, { passive: true });
    carBtns.forEach(b => b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const step = items[0].getBoundingClientRect().width + gap();
      const n = car.clientWidth > 900 ? 2 : 1;
      car.scrollBy({ left: +b.dataset.dir * step * n, behavior: RM.matches ? 'auto' : 'smooth' });
    }));
    // mouse drag (touch uses native scrolling)
    let drag = null;
    car.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, l: car.scrollLeft, moved: false, id: e.pointerId };
    });
    car.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; car.classList.add('drag'); try { car.setPointerCapture(drag.id); } catch (er) { /* ignore */ } }
      if (drag.moved) car.scrollLeft = drag.l - dx;
    });
    const endDrag = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved) return;
      const dir = Math.sign(d.l - car.scrollLeft);
      const pts = snapPoints();
      const cur = car.scrollLeft;
      let target = pts.reduce((a, p) => (Math.abs(p - cur) < Math.abs(a - cur) ? p : a), pts[0]);
      // favour the drag direction a little so short flicks still advance
      const next = dir > 0 ? pts.find(p => p > cur + 10) : [...pts].reverse().find(p => p < cur - 10);
      if (next != null && Math.abs(next - cur) < (items[0].offsetWidth * 0.7)) target = next;
      car.scrollTo({ left: target, behavior: RM.matches ? 'auto' : 'smooth' });
      setTimeout(() => car.classList.remove('drag'), 520);
    };
    car.addEventListener('pointerup', endDrag);
    car.addEventListener('pointercancel', endDrag);
    car.addEventListener('click', e => { if (car.classList.contains('drag')) e.preventDefault(); }, true);
    upd();
    addEventListener('resize', upd, { passive: true });
  }

  /* ============================== FAQ: one open at a time ============================== */
  // closing the item above must not pull the tapped question away from under the finger
  const qas = $$('.qa');
  let faqAnchor = null;
  qas.forEach(d => {
    const sm = $('summary', d);
    sm.addEventListener('click', () => { faqAnchor = { d, top: sm.getBoundingClientRect().top }; });
    d.addEventListener('toggle', () => {
      if (d.open) {
        qas.forEach(o => { if (o !== d && o.open) o.open = false; });
        if (faqAnchor && faqAnchor.d === d) {
          const dy = sm.getBoundingClientRect().top - faqAnchor.top;
          if (Math.abs(dy) > 1) {
            if (lenis) lenis.scrollTo((window.scrollY || 0) + dy, { immediate: true, force: true });
            else window.scrollBy(0, dy);
          }
        }
      }
      if (faqAnchor && faqAnchor.d === d) faqAnchor = null;
      if (built && window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });

  /* ============================== living tiles & paused atmosphere ============================== */
  if ('IntersectionObserver' in window && !RM.matches) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.target.classList.contains('aurora') || en.target.id === 'top') en.target.classList.toggle('off', !en.isIntersecting);
      else en.target.classList.toggle('live', en.isIntersecting);
    }), { rootMargin: '80px 0px' });
    $$('.tile').forEach(el => io.observe(el));
    $$('.aurora').forEach(el => io.observe(el));
    io.observe($('#top')); // pauses the H1 shimmer once the hero is gone
  }

  /* AI tile: scroll-driven conversation (never caught half-typed at rest) */
  const aiMsgs = $$('#tileAi .msg');
  let aiP = 1;
  function aiRender(p) {
    aiP = p;
    if (aiMsgs.length < 4) return;
    const seg = (a, b) => clamp((p - a) / (b - a), 0, 1);
    const show = (m, k) => { m.style.opacity = k.toFixed(3); m.style.transform = k < 1 ? `translateY(${((1 - k) * 14).toFixed(1)}px)` : ''; };
    const [m0, m1, m2, m3] = aiMsgs;
    show(m0, seg(0.02, 0.1));
    const tx = $('.tx', m0);
    const full = typo(t('ai.q'));
    const n = Math.round(seg(0.06, 0.24) * full.length);
    tx.textContent = full.slice(0, Math.max(1, n));
    tx.classList.toggle('caret', n > 0 && n < full.length);
    show(m1, seg(0.28, 0.36)); m1.classList.toggle('thinking', p < 0.44);
    show(m2, seg(0.52, 0.6));
    show(m3, seg(0.66, 0.74)); m3.classList.toggle('thinking', p < 0.82);
  }

  /* ============================== CINEMA ============================== */
  let built = false, ctx = null;
  let layersVisible = false;
  let placeLabels = () => {};
  // the shared left/right content edge (nav, cinema copy, sections) — see --cx in style.css
  const cxPx = () => parseFloat(getComputedStyle($('.nav-in')).paddingLeft) || 20;

  function buildHero(mob, vw, vh) {
    const cam = $('.hero-cam'), island = $('.hero .island');
    const navH = mob ? 52 : 56;
    let W, Yf;
    if (!mob) {
      W = Math.round(Math.min(330, (vh * 0.7) / 2.1741));
      Yf = 26;
    } else {
      const tt = $('.b-title');
      const leadTop = tt.offsetTop + tt.offsetHeight + 16;
      html.style.setProperty('--mLeadTop', leadTop + 'px');
      const bs = $('.b-side');
      const top = leadTop + bs.offsetHeight + 24;
      const fitW = (vh - top - 14) / 2.2641;
      W = Math.round(Math.max(Math.min(vw * 0.46, 178), Math.min(vw * 0.58, 250, fitW)));
      Yf = top + (W * 2.2641) / 2 - vh / 2;
    }
    cam.style.setProperty('--W', W + 'px');
    const b = W * 0.045, camW = W + 2 * b, camH = W * 2.1741 + 2 * b;
    if (!mob) { // text columns sit on the shared content edge and stop short of the phone
      const col = vw / 2 - camW / 2 - 48 - cxPx();
      html.style.setProperty('--colT', Math.round(clamp(col, 260, 600)) + 'px');
      html.style.setProperty('--colS', Math.round(clamp(col, 260, 430)) + 'px');
    }
    const exp = { left: W * 0.03, top: W * 0.028, width: W * 0.94, height: W * 0.34, borderRadius: W * 0.12 };
    const cmp = { left: W * 0.285, top: W * 0.0367, width: W * 0.43, height: W * 0.088, borderRadius: W * 0.044 };
    const oy = b + exp.top + exp.height / 2;
    const S0 = mob ? (0.92 * vw) / exp.width : Math.min((0.64 * vw) / exp.width, 4.2);
    // opening close-up: keep the scaled bezel clear of the nav on wide screens
    const islY = Math.max((mob ? 0.3 : 0.33) * vh, navH + (mob ? 16 : 24) + oy * S0);
    const Y0 = islY - (vh / 2 - camH / 2 + oy);
    html.style.setProperty('--aTop', (islY + (exp.height * S0) / 2 + (mob ? 34 : 44)) + 'px');

    gsap.set(cam, { transformOrigin: `${camW / 2}px ${oy}px`, scale: S0, y: Y0, x: 0 });
    gsap.set(island, { ...exp });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });
    tl.set({}, {}, 6);
    tl.to(cam, { scale: 1, y: Yf, duration: 2.6, ease: 'power2.inOut' }, 0.3);
    tl.to('.copyA', { opacity: 0, y: -50, duration: 0.8, ease: 'power1.in' }, 0.3);
    tl.fromTo('.hero .shot', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1.2);
    tl.fromTo('.hero .aurora', { opacity: 0.4, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.8 }, 0.9);
    tl.to(island, { ...cmp, duration: 1, ease: 'power2.inOut' }, 1.8);
    tl.to('.hero .isl-exp', { opacity: 0, duration: 0.35 }, 1.8);
    tl.fromTo('.hero .isl-cmp', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 2.35);
    tl.fromTo('.b-title .ln > span', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, 2.45);
    tl.fromTo('.b-side > *', { opacity: 0, y: mob ? 10 : 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }, 2.8);
    tl.set('.b-side', { pointerEvents: 'auto' }, 2.9); // invisible copy must not take taps (reverts when scrubbing back)
    tl.to('.hero .aurora', { opacity: 0.7, duration: 1.4 }, 4.4);
    const st = tl.scrollTrigger;
    const T_SIDE = 3.75;
    heroSide = { st, frac: T_SIDE / tl.duration() };
  }

  function layersTimeline(mob, vw, vh, yEnd) {
    const cam = $('.layers-cam'), tilt = $('.layers .tilt'), rig = $('.layers .rig'), screen = $('.layers .screen');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.layers', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });
    tl.set({}, {}, mob ? 6 : 4.3); // a short hold after the last callout, then the pin releases
    tl.to(cam, mob ? { y: yEnd, duration: 1.4, ease: 'power2.inOut' } : { y: vh * 0.08, x: -vw * 0.06, duration: 1.4, ease: 'power2.inOut' }, 0);
    tl.to(tilt, { rotationX: 58, duration: 1.4, ease: 'power2.inOut' }, 0);
    tl.to(rig, { rotationZ: -42, scale: mob ? 0.92 : 0.9, duration: 1.4, ease: 'power2.inOut' }, 0);
    tl.fromTo('.layers .aurora', { opacity: 0.35, scale: 0.85 }, { opacity: 1, scale: 1.05, duration: 3 }, 0);
    tl.to(screen, { '--ex': mob ? 1.15 : 1.35, duration: 2.2, ease: 'power2.inOut' }, 0.9);
    tl.fromTo('.layers .dim', { opacity: 0 }, { opacity: 0.7, duration: 1.8 }, 0.9);
    if (!mob) {
      $$('.lab').forEach((l, i) => tl.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 1.6 + i * 0.5));
    } else {
      const mcs = $$('.mc'), dots = $$('.mc-dots i');
      const starts = mcs.map((m, i) => 1.3 + i * 1.25);
      mcs.forEach((m, i) => {
        tl.fromTo(m, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35 }, starts[i]);
        if (i < mcs.length - 1) tl.to(m, { opacity: 0, y: -14, duration: 0.25, ease: 'power1.in' }, starts[i] + 0.95);
      });
      tl.eventCallback('onUpdate', () => {
        const time = tl.time();
        let k = -1;
        starts.forEach((s, i) => { if (time >= s) k = i; });
        dots.forEach((d, i) => d.classList.toggle('on', i === Math.max(0, k)));
      });
    }
    return tl;
  }

  function buildLayers(mob, vw, vh) {
    const cam = $('.layers-cam');
    const W = mob ? Math.round(Math.min(vw * 0.42, 280, (vh * (vw >= 600 ? 0.5 : 0.46)) / 2.1741)) : Math.round(Math.min(330, (vh * 0.7) / 2.1741));
    cam.style.setProperty('--W', W + 'px');
    gsap.set(cam, { x: 0, y: mob ? vh * 0.03 : 20 });
    let yEnd = vh * 0.03;
    if (mob) {
      // measure the exploded pose, then centre phone + caption between the title and the bottom edge
      const probe = layersTimeline(mob, vw, vh, yEnd);
      probe.scrollTrigger.disable(false);
      probe.progress(1);
      const pin = $('.layers .pin').getBoundingClientRect();
      const r = $$('.layers .ly').map(el => el.getBoundingClientRect());
      const top = Math.min(...r.map(q => q.top)) - pin.top, bottom = Math.max(...r.map(q => q.bottom)) - pin.top;
      const titleBottom = $('.copyC').getBoundingClientRect().bottom - pin.top;
      probe.progress(0);
      probe.scrollTrigger.kill();
      probe.kill();
      gsap.set(cam, { x: 0, y: mob ? vh * 0.03 : 20 });
      const capH = 84 + 16;
      const groupH = (bottom - top) + 18 + capH;
      const regionTop = titleBottom + 8, regionBot = vh - 18;
      const wantTop = regionTop + Math.max(0, (regionBot - regionTop - groupH) / 2);
      yEnd += wantTop - top;
      const capTop = Math.min(vh - capH - 12, wantTop + (bottom - top) + 18);
      $('.mcap').style.top = capTop + 'px';
      $('.mcap').style.bottom = 'auto';
    }
    layersTimeline(mob, vw, vh, yEnd);

    gsap.fromTo('.c-title .ln > span', { yPercent: 110, opacity: 0 }, {
      yPercent: 0, opacity: 1, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.layers', start: 'top 70%', end: 'top 5%', scrub: 0.6 },
    });
    gsap.fromTo('.copyC .eyebrow, .copyC .c-sub', { opacity: 0 }, {
      opacity: 1, scrollTrigger: { trigger: '.layers', start: 'top 60%', end: 'top 10%', scrub: 0.6 },
    });

    // desktop leader lines, pin-relative
    const svg = $('.leaders');
    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    const labels = $$('.lab');
    const anchors = $$('.anc').sort((a, b) => a.dataset.a - b.dataset.a);
    const lines = labels.map(() => {
      const g = document.createElementNS(NS, 'g');
      const l = document.createElementNS(NS, 'line');
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '3.5');
      g.append(l, c); svg.append(g);
      return { g, l, c };
    });
    const pinEl = $('.layers .pin');
    placeLabels = () => {
      if (mob || !layersVisible) return;
      const pr = pinEl.getBoundingClientRect();
      const pts = anchors.map(a => { const r = a.getBoundingClientRect(); return { x: r.left - pr.left + 1, y: r.top - pr.top + 1 }; });
      const maxX = Math.max(...pts.map(p => p.x));
      const lx = Math.max(maxX + 70, vw - cxPx() - 280); // label column ends on the content edge
      const hs = labels.map(l => l.offsetHeight);
      const gapY = Math.max(112, Math.max(...hs) + 18);
      const ys = pts.map(p => p.y);
      for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + gapY);
      const meanA = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const meanL = ys.reduce((s, y) => s + y, 0) / ys.length;
      let shift = meanA - meanL;
      const top = 90, bot = vh - 40 - hs[hs.length - 1];
      if (ys[0] + shift < top) shift = top - ys[0];
      if (ys[ys.length - 1] + shift > bot) shift = bot - ys[ys.length - 1];
      labels.forEach((lab, i) => {
        const y = ys[i] + shift;
        lab.style.transform = `translate(${lx}px, ${y - 30}px)`;
        const L = lines[i];
        L.l.setAttribute('x1', pts[i].x); L.l.setAttribute('y1', pts[i].y);
        L.l.setAttribute('x2', lx - 14); L.l.setAttribute('y2', y - 22);
        L.c.setAttribute('cx', pts[i].x); L.c.setAttribute('cy', pts[i].y);
        L.g.style.opacity = gsap.getProperty(lab, 'opacity');
      });
    };
  }

  function buildPain() {
    let words = $$('#pain .w');
    const paint = p => {
      const n = words.length;
      const f = p * (n + 3);
      words.forEach((w, i) => { w.style.opacity = (0.16 + 0.84 * clamp(f - i, 0, 1)).toFixed(3); });
    };
    ScrollTrigger.create({
      trigger: '#pain .pain-lines', start: 'top 80%', end: 'bottom 50%',
      onUpdate: s => paint(s.progress),
      onRefresh: s => { words = $$('#pain .w'); paint(s.progress); },
    });
  }

  function buildBento() {
    gsap.fromTo('.bento', { rotationX: -12, transformPerspective: 1800, transformOrigin: '50% 0%' },
      { rotationX: 0, ease: 'none', scrollTrigger: { trigger: '.bento', start: 'top bottom', end: 'top 35%', scrub: 0.6 } });
    $$('.pro-head > *').forEach((el, i) => gsap.fromTo(el, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, ease: 'power2.out',
      scrollTrigger: { trigger: '.pro-head', start: `top ${96 - i * 3}%`, end: `top ${66 - i * 3}%`, scrub: 0.6 },
    }));
    $$('.tile').forEach(tile => {
      gsap.fromTo(tile, { y: 90, opacity: 0, scale: 0.95 }, {
        y: 0, opacity: 1, scale: 1, ease: 'power2.out',
        scrollTrigger: { trigger: tile, start: 'top 102%', end: 'top 76%', scrub: 0.6 },
      });
    });
    // AI conversation scrubbed by scroll
    ScrollTrigger.create({
      trigger: '#tileAi', start: 'top 88%', end: 'top 32%',
      onUpdate: s => aiRender(s.progress),
      onRefresh: s => aiRender(s.progress),
    });
    // quick one-shot plays (≤1.4 s) when a tile is well in view; initial states set now
    const plays = {
      stats(tile) {
        const ring = $('.val', tile), pct = $('[data-count]', tile), inc = $('[data-money]', tile);
        const total = moneyVal(inc), step = total >= 10000 ? 100 : 10;
        gsap.set(ring, { strokeDashoffset: 100 });
        pct.textContent = '0'; inc.textContent = fmtMoney(0);
        return () => {
          const o = { v: 0 };
          gsap.to(ring, { strokeDashoffset: 19, duration: 1.3, ease: 'power3.out' });
          gsap.to(o, { v: 1, duration: 1.3, ease: 'power3.out', onUpdate: () => {
            pct.textContent = Math.round(81 * o.v);
            inc.textContent = fmtMoney(o.v >= 1 ? total : Math.round((total * o.v) / step) * step);
          } });
        };
      },
      widget(tile) {
        const rows = $$('.w-row', tile);
        gsap.set(rows, { opacity: 0, x: -14 });
        return () => gsap.to(rows, { opacity: 1, x: 0, stagger: 0.1, duration: 0.45, ease: 'power2.out' });
      },
      report(tile) {
        const days = $$('.rp-days i', tile), pay = $('.rp-pay', tile);
        gsap.set(days, { scale: 0, opacity: 0 }); gsap.set(pay, { opacity: 0, y: 6 });
        return () => {
          gsap.to(days, { scale: 1, opacity: 1, stagger: 0.08, duration: 0.4, ease: 'back.out(2.2)' });
          gsap.to(pay, { opacity: 1, y: 0, duration: 0.4, delay: 0.45 });
        };
      },
      watch(tile) {
        const v = $('.w-screen .val', tile);
        gsap.set(v, { strokeDashoffset: 100 });
        return () => gsap.to(v, { strokeDashoffset: 66, duration: 1.2, ease: 'power3.out' });
      },
      lock(tile) {
        const la = $('.la', tile), bar = $('.la-bar i', tile);
        gsap.set(la, { y: 30, opacity: 0 }); gsap.set(bar, { width: '0%' });
        return () => {
          gsap.to(la, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
          gsap.to(bar, { width: '34%', duration: 0.9, delay: 0.3, ease: 'power2.out' });
        };
      },
      siri(tile) {
        const orb = $('.orb', tile);
        gsap.set(orb, { scale: 0.6 });
        return () => gsap.to(orb, { scale: 1, duration: 1, ease: 'elastic.out(1,.5)' });
      },
      att(tile) {
        const bars = $$('.att-bar i', tile);
        gsap.set(bars, { scaleX: 0 });
        return () => gsap.to(bars, { scaleX: 1, stagger: 0.1, duration: 0.9, ease: 'power3.out' });
      },
      unl(tile) {
        const p = $('.inf path', tile), avs = $$('.avs .av', tile);
        gsap.set(p, { strokeDashoffset: 1 }); gsap.set(avs, { opacity: 0, y: 8 });
        return () => {
          gsap.to(p, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' });
          gsap.to(avs, { opacity: 1, y: 0, stagger: 0.06, duration: 0.35, delay: 0.3 });
        };
      },
    };
    $$('.tile[data-play]').forEach(tile => {
      const mk = plays[tile.dataset.play];
      if (!mk) return;
      const play = mk(tile);
      let done = false;
      const run = () => { if (!done) { done = true; play(); } };
      ScrollTrigger.create({ trigger: tile, start: 'top 80%', end: 'bottom top', onEnter: run, onLeave: run, onEnterBack: run });
    });
  }

  function buildTap() {
    const lsRing = $('#lsRing'), lsNum = $('#lsNum');
    lsNum.textContent = '5/8';
    gsap.set(lsRing, { strokeDashoffset: 3 });
    gsap.fromTo('.tap-title .ln:nth-child(1) > span', { yPercent: 110 }, {
      yPercent: 0, ease: 'power3.out', scrollTrigger: { trigger: '#tap', start: 'top 70%', end: 'top 15%', scrub: 0.6 },
    });
    gsap.fromTo('.tap-row', { opacity: 0, y: 60 }, {
      opacity: 1, y: 0, ease: 'power2.out', scrollTrigger: { trigger: '#tap', start: 'top 60%', end: 'top 5%', scrub: 0.6 },
    });
    const ring = { v: 5 };
    const t2 = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#tap', start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
    t2.set({}, {}, 4);
    t2.fromTo('.tap-title .ln:nth-child(2) > span', { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'power3.out' }, 0.1);
    t2.fromTo('.bc-ring', { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1, ease: 'power2.inOut' }, 0.7);
    t2.fromTo('.ripple', { opacity: 0.55, scale: 0.6 }, { opacity: 0, scale: 2.1, duration: 0.6, ease: 'power2.out', immediateRender: false }, 1.55);
    t2.fromTo('#lsBtn', { backgroundColor: 'rgba(92,255,179,0.08)', borderColor: 'rgba(92,255,179,0.55)', boxShadow: '0 0 0px rgba(92,255,179,0)' },
      { backgroundColor: '#5CFFB3', borderColor: '#5CFFB3', boxShadow: '0 0 30px rgba(92,255,179,0.55)', duration: 0.3 }, 1.6);
    t2.fromTo('#lsBtn svg', { stroke: '#5CFFB3' }, { stroke: '#04311d', duration: 0.3 }, 1.6);
    t2.fromTo('#lsTick', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.4 }, 1.6);
    t2.fromTo('.bc-tick', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 1.75);
    t2.fromTo('.bc-glow', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.9 }, 1.9);
    t2.fromTo(ring, { v: 5 }, {
      v: 6, duration: 0.8, ease: 'power2.inOut', onUpdate: () => {
        lsRing.style.strokeDashoffset = 8 - ring.v;
        lsNum.textContent = (ring.v >= 5.5 ? 6 : 5) + '/8';
      },
    }, 2.0);
    t2.fromTo('#lsDone', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, 2.6);
    t2.fromTo('#tapCap', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 2.8);
    t2.fromTo('.tap-wash', { opacity: 0.3 }, { opacity: 1, duration: 1.4 }, 1.6);
  }

  function buildReveals() {
    $$('[data-reveal]').forEach(el => {
      gsap.set(el, { opacity: 0, y: 36 });
      let done = false;
      const show = () => { if (done) return; done = true; gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }); };
      ScrollTrigger.create({ trigger: el, start: 'top 90%', end: 'bottom top', onEnter: show, onLeave: show, onEnterBack: show });
    });
    gsap.fromTo('.scr-head', { opacity: 0, y: 36 }, { opacity: 1, y: 0, ease: 'power2.out', scrollTrigger: { trigger: '.screens', start: 'top 85%', end: 'top 45%', scrub: 0.6 } });
    gsap.fromTo('.car-item', { opacity: 0, x: 80 }, {
      opacity: 1, x: 0, stagger: 0.06, ease: 'power2.out',
      scrollTrigger: { trigger: '.car', start: 'top 95%', end: 'top 50%', scrub: 0.6 },
    });
    gsap.fromTo('.join .aurora', { opacity: 0.3 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.join', start: 'top bottom', end: 'center center', scrub: true } });
  }

  function build() {
    html.classList.remove('no-cine'); html.classList.add('cine');
    const vw = innerWidth, vh = innerHeight, mob = STACK_MQ.matches;
    ctx = gsap.context(() => {
      buildHero(mob, vw, vh);
      buildPain();
      buildLayers(mob, vw, vh);
      buildBento();
      buildTap();
      buildReveals();
    });
    built = true;
    html.classList.add('cine-ready');
    ScrollTrigger.refresh();
    carUpd();
  }
  function teardown() {
    heroSide = null;
    if (ctx) ctx.revert();
    ctx = null;
    $$('.lab').forEach(l => { l.style.transform = ''; });
    const mc = $('.mcap'); if (mc) { mc.style.top = ''; mc.style.bottom = ''; }
  }
  function rebuild() {
    if (!built) return;
    teardown();
    build();
    aiRender(aiP);
  }
  function goStatic() { // e.g. the phone turned to landscape: back to the plain layout
    if (built) teardown();
    built = false;
    html.classList.remove('cine', 'cine-ready'); html.classList.add('no-cine');
    aiRender(1);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    carUpd();
  }
  // layout signature: after web fonts arrive, rebuild only if they actually moved something
  const layoutSig = () => ['.b-title', '.b-side', '.c-title', '.pain-lines', '.tap-title']
    .map(q => { const e = $(q); return e ? e.offsetWidth + 'x' + e.offsetHeight : ''; }).join(',');

  function startCinema() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    try {
      if (window.Lenis) {
        lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(time => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }
    } catch (e) { lenis = null; }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(en => { layersVisible = en[0].isIntersecting; }) : null;
    if (io) io.observe($('.layers')); else layersVisible = true;
    gsap.ticker.add(() => placeLabels());
    const fontsPending = !!(document.fonts && document.fonts.status !== 'loaded');
    if (LAND_MQ.matches) goStatic(); else build();
    if (fontsPending) {
      const sig0 = layoutSig();
      document.fonts.ready.then(() => {
        if (!built) return;
        if (layoutSig() !== sig0) rebuild(); else ScrollTrigger.refresh();
      });
    }
    // keyboard users tabbing into the (still hidden) hero copy get scrolled to it
    $('.hero .b-side').addEventListener('focusin', () => {
      const hy = heroSideYNow();
      if (hy != null && (window.scrollY || 0) < hy - 4) scrollToY(hy);
    });
    let lastW = innerWidth, lastH = innerHeight, rT = 0;
    addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => {
        const dw = Math.abs(innerWidth - lastW), dh = Math.abs(innerHeight - lastH);
        const touch = matchMedia('(pointer: coarse)').matches;
        if (dw < 2 && (touch || dh < 2)) return; // mobile URL-bar show/hide: keep the cinema as is
        lastW = innerWidth; lastH = innerHeight;
        if (!menu.hidden && innerWidth >= 900) setMenu(false, { focus: false });
        if (LAND_MQ.matches) { if (built) goStatic(); return; }
        if (!built) { build(); aiRender(aiP); return; }
        rebuild();
      }, 180);
    });
  }

  /* ============================== boot ============================== */
  // language, App Store state, menu, carousel work right away; the cinema starts once the (deferred)
  // animation libraries have run — unless the <head> timer already gave up on them (slow network).
  applyLang(lang);
  detectStore();
  let started = false;
  function go() {
    if (started) return;
    started = true;
    const hasGsap = !!(window.gsap && window.ScrollTrigger);
    if (!hasGsap || RM.matches || html.classList.contains('no-cine')) {
      html.classList.remove('cine', 'cine-ready'); html.classList.add('no-cine');
      return;
    }
    try { startCinema(); } catch (e) {
      // anything goes wrong → fall back to the static layout, never leave content hidden
      if (ctx) try { ctx.revert(); } catch (er) { /* ignore */ }
      html.classList.remove('cine', 'cine-ready'); html.classList.add('no-cine');
      built = false;
      if (window.console) console.warn('cinema disabled:', e);
    }
  }
  if (document.readyState === 'complete') go();
  else { document.addEventListener('DOMContentLoaded', go); addEventListener('load', go); }
  addEventListener('resize', () => { if (!menu.hidden && innerWidth >= 900) setMenu(false, { focus: false }); }, { passive: true });
})();
