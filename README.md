# Schedule Lesson — website

Static marketing site for the Schedule Lesson iPhone app (for private tutors), served by GitHub Pages:
https://schedulelesson.app/

- `index.html` (Ukrainian), `ru.html`, `en.html` — pre-rendered per language by `_build/prerender.mjs`
- `css/`, `js/` (`js/vendor/` — GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13), `assets/`
- `privacy.html`, `terms.html`, `support.html`

Rebuild language pages after editing `index.html` or `js/i18n.js`:

    SITE_ORIGIN=https://schedulelesson.app node _build/prerender.mjs
