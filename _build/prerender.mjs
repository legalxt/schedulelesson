// Pre-renders one static HTML page per language from index.html + js/i18n.js:
//   index.html (uk, also x-default), ru.html, en.html, pl.html, de.html, fr.html, es.html, it.html
// so crawlers, link-preview bots and no-JS visitors get the right language, title, description,
// og/twitter tags and hreflang without running JavaScript. main.js still re-applies the language
// at runtime (switching in place and updating the URL to the matching page).
//
// Run after editing index.html or js/i18n.js (no dependencies, Node 18+):
//   node _build/prerender.mjs                                   # relative URLs (domain not decided yet)
//   SITE_ORIGIN=https://example.com node _build/prerender.mjs   # absolute canonical/hreflang/og:url/og:image + sitemap.xml
// RELEASE DAY (once the app is confirmed live on the App Store), re-run with STORE_LIVE=1:
//   SITE_ORIGIN=https://legalxt.github.io/schedulelesson STORE_LIVE=1 node _build/prerender.mjs
// That makes LIVE the static default (<html class="sl-live" data-store="released">, nav/menu CTA → store) for no-JS
// visitors and crawlers, stops the runtime iTunes lookup (main.js) and adds downloadUrl/installUrl to the JSON-LD.
// Without the flag the page is NOT LIVE by default and the JSON-LD has no download URL (the store page 404s before release).
// The folder starts with "_" so GitHub Pages (Jekyll) does not publish it.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '');
const LANGS = ['uk', 'ru', 'en', 'pl', 'de', 'fr', 'es', 'it']; // keep in sync with LANGS in js/main.js and the <head> script
const PAGE = { uk: '', ru: 'ru.html', en: 'en.html', pl: 'pl.html', de: 'de.html', fr: 'fr.html', es: 'es.html', it: 'it.html' };
const LOCALE = { uk: 'uk_UA', ru: 'ru_RU', en: 'en_US', pl: 'pl_PL', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', it: 'it_IT' };
const STORE_URL = 'https://apps.apple.com/app/id6817674096'; // keep in sync with APP_ID in js/main.js
const RELEASED = process.env.STORE_LIVE === '1';
const OG_VER = '2'; // bump when assets/og-*.jpg change: Facebook/Telegram/Viber cache previews by image URL

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SITE, 'js/i18n.js'), 'utf8'), box);
const D = box.window.SL_I18N;
const src = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

/* ---- the same text helpers as js/main.js (keep in sync) ---- */
const NB = '\u00a0';
const CYR1 = /(^|[\s(«"„])([вуійзаоиксяВУІЙЗАОИКСЯ])\s(?=\S)/g;
const ONE = { uk: CYR1, ru: CYR1, pl: /(^|[\s(„"])([aiouwzAIOUWZ])\s(?=\S)/g };
function typoText(v, l) {
  let r = v.replace(/ (—|–|→)/g, NB + '$1').replace(/(\d) (?=\d{3}(?!\d))/g, '$1' + NB).replace(/ (₴|€|zł)/g, NB + '$1');
  const re = ONE[l];
  if (re) r = r.replace(re, '$1$2' + NB).replace(re, '$1$2' + NB);
  if (l === 'fr') r = r.replace(/ ([:;!?»])/g, NB + '$1').replace(/« /g, '«' + NB);
  return r;
}
const ONE_CH = { uk: 'вуійзаоиксяВУІЙЗАОИКСЯ', ru: 'вуійзаоиксяВУІЙЗАОИКСЯ', pl: 'aiouwzAIOUWZ' };
const glueTag = (v, l) => (ONE_CH[l] ? v.replace(new RegExp('(^|[\\s(«"„>])([' + ONE_CH[l] + ']) (?=<[a-z])', 'g'), '$1$2' + NB) : v); // "і <em>…"
const typo = (v, l, isHtml = false) => (!v ? v : !isHtml ? typoText(v, l) : glueTag(v, l).replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag || typoText(txt, l)));
const TAGS = { g: 'gt', m: 'gt-m', d: 'dim-txt' };
const rich = v => v.replace(/<(\/?)([gmd])>/g, (m, c, tag) => (c ? '</span>' : `<span class="${TAGS[tag]}">`));
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const CUR = { pl: ['pl-PL', 'PLN'], de: ['de-DE', 'EUR'], fr: ['fr-FR', 'EUR'], es: ['es-ES', 'EUR'], it: ['it-IT', 'EUR'] };
function fmtMoney(v, l) {
  if (l === 'en') return '$' + Number(v).toLocaleString('en-US');
  if (CUR[l]) return new Intl.NumberFormat(CUR[l][0], { style: 'currency', currency: CUR[l][1], maximumFractionDigits: 0, minimumFractionDigits: 0, useGrouping: l === 'de' ? 'auto' : 'min2' }).format(Number(v)).replace(/[\s\u202f]/g, NB);
  return Number(v).toLocaleString('uk-UA').replace(/\s/g, NB) + NB + '₴';
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const escA = s => esc(s).replace(/"/g, '&quot;');
const nbspEnt = s => s.replace(/ /g, '&nbsp;');

/* ---- tiny HTML helpers ---- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const attrOf = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
function setAttr(tag, name, value) {
  const re = new RegExp(`(\\s${name}=")[^"]*(")`);
  const v = escA(value);
  return re.test(tag) ? tag.replace(re, (m, a, b) => a + v + b) : tag.replace(/\s*(\/?)>$/, ` ${name}="${v}"$1>`);
}
function closeIndex(html, from, name) { // index of the matching </name>
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (--depth === 0) return m.index; } else if (!m[0].endsWith('/>')) depth++;
  }
  throw new Error('unclosed <' + name + '> at ' + from);
}

function render(L) {
  const t = k => {
    const v = D[L][k] ?? D.uk[k];
    if (v == null) throw new Error(`missing i18n key "${k}" (${L})`);
    return v;
  };
  let out = '';
  let i = 0;
  const tagRe = /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<([a-zA-Z][\w-]*)(\s[^>]*)?>/g;
  let m;
  while ((m = tagRe.exec(src))) {
    out += src.slice(i, m.index);
    i = m.index + m[0].length;
    const name = m[1];
    let tag = m[0];
    if (!name) { out += tag; continue; } // comment / script: copy as is

    // attributes
    const ia = attrOf(tag, 'data-i18n-attr');
    if (ia) ia.split(',').forEach(pair => {
      const [a, k] = pair.split(':').map(s => s.trim());
      tag = setAttr(tag, a, a === 'href' || a === 'content' || a === 'src' ? t(k) : typo(t(k), L));
    });
    const shot = attrOf(tag, 'data-shot');
    if (shot && name === 'img' && attrOf(tag, 'src') != null) tag = setAttr(tag, 'src', `assets/shots/${L}/${shot}.jpg`);
    const altK = attrOf(tag, 'data-alt');
    if (altK) tag = setAttr(tag, 'alt', typo(t(altK), L));
    const altShot = attrOf(tag, 'data-alt-shot');
    if (altShot) tag = setAttr(tag, 'alt', typo(fill(t('shot.alt'), { t: t(`g.${altShot}.t`), d: t(`g.${altShot}.d`) }), L));
    if (/\sclass="lang-opt"/.test(tag)) { // language menu: mark this page's language
      tag = tag.replace(/\saria-current="[^"]*"/, '');
      if (attrOf(tag, 'data-lang') === L) tag = setAttr(tag, 'aria-current', 'true');
    }
    if (name === 'html') {
      tag = setAttr(tag, 'lang', L);
      tag = L === 'uk' ? tag.replace(/\sdata-page-lang="[^"]*"/, '') : setAttr(tag, 'data-page-lang', L);
      tag = tag.replace(/\s(class|data-store)="[^"]*"/g, ''); // idempotent: index.html is both source and output
      if (RELEASED) { tag = setAttr(tag, 'class', 'sl-live'); tag = setAttr(tag, 'data-store', 'released'); }
    }
    if (/\sdata-cta[\s>]/.test(tag)) tag = setAttr(tag, 'href', RELEASED ? STORE_URL : '#join');

    // content
    let inner = null;
    const k1 = attrOf(tag, 'data-i18n'), k2 = attrOf(tag, 'data-i18n-html'), k3 = attrOf(tag, 'data-lines'), k4 = attrOf(tag, 'data-words'), money = attrOf(tag, 'data-money');
    if (k1) inner = esc(typo(t(k1), L));
    else if (k2) inner = nbspEnt(rich(typo(t(k2), L, true)));
    else if (k3) inner = t(k3).split('|').map(line => `<span class="ln"><span>${nbspEnt(rich(typo(line, L, true)))}</span></span>`).join(' ');
    else if (k4) inner = nbspEnt(rich(typo(t(k4), L, true)));
    else if (money) inner = esc(fmtMoney(/^\d+$/.test(money) ? money : t(money), L));
    else if (name === 'title') inner = esc(t('meta.title'));
    else if (name === 'div' && /\sclass="avs"/.test(tag)) {
      const end = closeIndex(src, i, 'div');
      const avs = t('unl.avs').split(',');
      let n = 0;
      inner = src.slice(i, end).replace(/(<span class="av av-(?!more)[^"]*">)[^<]*(<\/span>)/g, (mm, a, b) => a + esc(avs[n++] || '') + b);
    }
    out += tag;
    if (inner != null && !VOID.has(name.toLowerCase())) {
      const end = closeIndex(src, i, name);
      out += inner;
      i = end;
      tagRe.lastIndex = end;
    }
  }
  out += src.slice(i);

  // generated SEO block
  const abs = p => (ORIGIN ? `${ORIGIN}/${p}` : p || './');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Schedule Lesson',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'iOS 17 or later',
    description: 'An iPhone app for private tutors: schedule, students, lesson packs and one-off lessons, payments and debts, a lesson journal, statistics, parent reports and payment reminders.',
    inLanguage: ['uk', 'en', 'ru', 'pl', 'de', 'fr', 'es', 'it'],
    image: abs('assets/icon.png'),
    ...(ORIGIN ? { url: abs(PAGE[L]) } : {}),
    ...(RELEASED ? { downloadUrl: STORE_URL, installUrl: STORE_URL } : {}),
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro (monthly)', price: '6.99', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro (yearly)', price: '24.99', priceCurrency: 'USD' },
    ],
  };
  const seo = [
    `<link rel="canonical" href="${abs(PAGE[L])}">`,
    ...LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${abs(PAGE[l])}">`),
    `<link rel="alternate" hreflang="x-default" href="${abs('')}">`,
    ...LANGS.filter(l => l !== L).map(l => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`),
    ...(ORIGIN ? [`<meta property="og:url" content="${abs(PAGE[L])}">`] : []),
    `<meta property="og:image" content="${abs(`assets/og-${L}.jpg?v=${OG_VER}`)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta name="twitter:image" content="${abs(`assets/og-${L}.jpg?v=${OG_VER}`)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  ].join('\n');
  out = out.replace(/(<!--seo:start[^>]*-->)[\s\S]*?(<!--seo:end-->)/, `$1\n${seo}\n$2`);
  if (!out.includes(seo)) throw new Error('seo markers not found');
  return out;
}

for (const L of LANGS) {
  const file = path.join(SITE, L === 'uk' ? 'index.html' : `${L}.html`);
  fs.writeFileSync(file, render(L));
  console.log('wrote', path.relative(SITE, file), RELEASED ? '(STORE_LIVE: released default)' : '(not live default)');
}

if (ORIGIN) {
  const alts = [...LANGS.map(a => `    <xhtml:link rel="alternate" hreflang="${a}" href="${ORIGIN}/${PAGE[a]}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>`].join('\n');
  const urls = LANGS.map(l => `  <url>\n    <loc>${ORIGIN}/${PAGE[l]}</loc>\n${alts}\n  </url>`).join('\n');
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  console.log('wrote sitemap.xml, robots.txt');
} else {
  console.log('SITE_ORIGIN not set: canonical/hreflang/og:image stay relative, no sitemap.xml (re-run with SITE_ORIGIN before deploy)');
}
