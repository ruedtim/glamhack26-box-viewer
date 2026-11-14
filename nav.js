/* One site header for all Provenance Pursuit pages – GLAMhack 2026, challenge 304.
 *
 * Include once per page, in <head> after feedback.js:  <script src="nav.js"></script>   (label-search: ../nav.js)
 *
 * - Pages without a site header of their own (entry form, review page, search by photo, What SIK-ISEA adds) get one as
 *   the first child of <body>: the name of the site (to the results), Labels / Works / Found again, a «Tools» menu,
 *   About and How we got here. It is not sticky. On narrow screens the links fold into one «Menu».
 * - Pages that have the site header in their markup (index.html, how-we-got-here.html: a <header> with the tab links)
 *   keep it; the script only adds the «Tools» menu (and a missing «How we got here» link) to its <nav>.
 * - The «Tools» menu says how many entries and decisions this browser holds (entry form, review page, search by photo),
 *   so nobody has to open three pages to see what is still to be downloaded for the team.
 * - As soon as the script runs, <html> gets the class «ppnav-on» and every element with the attribute data-ppnav-hide
 *   is hidden: pages mark their own old back link with it, which stays as the fallback without JavaScript.
 * - window.ppNavOff = true before this script switches it off on a page.
 */
(() => {
  if (window.ppNav || window.ppNavOff) return;
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const BASE = new URL('.', here);                         // the site's folder, also from label-search/
  const rel = location.pathname.startsWith(BASE.pathname) ? location.pathname.slice(BASE.pathname.length) : '';
  const url = p => new URL(p, BASE).href;
  const PAGE = rel === '' || rel === 'index.html' ? 'results' : rel === 'how-we-got-here.html' ? 'how'
    : rel === 'form.html' ? 'form' : rel === 'review.html' ? 'review' : rel === 'sik_isea.html' ? 'sik'
    : rel.startsWith('label-search/') ? 'search' : '';

  const TABS = [['Labels', './#labels'], ['Works', './#works'], ['Found again', './#again']];
  const TOOLS = [
    ['form', 'Record a label', 'form.html', 'entry form for SKKG\'s label register; opens from any box', 'pp-label-form-v1', 'saved'],
    ['review', 'Review the model\'s proposals', 'review.html', 'is the box on the mark? correct, wrong, unsure or redraw', 'pp-model-review-v1', 'decided'],
    ['search', 'Search by photo', 'label-search/', 'have I seen this label before?', 'pp-label-search-review-v1', 'decided'],
    ['sik', 'What SIK-ISEA adds', 'sik_isea.html', 'links and counts, with our label evidence', '', ''],
    ['', 'Workbook (Excel)', 'provenance_pursuit_results.xlsx', 'all results in one file', '', ''],
  ];
  const END = [['about', 'About', './#about'], ['how', 'How we got here', 'how-we-got-here.html']];

  const stored = key => {  // how many entries this browser holds under a key
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? Object.keys(v).length : 0; }
    catch { return 0; }
  };
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    e.append(...kids.filter(k => k !== null && k !== undefined));
    return e;
  };

  const css = `
.ppnav, .ppnav-tools { --pn-bg: #fff; --pn-ink: #1d1d1b; --pn-muted: #6b6860; --pn-line: #e2ded6; --pn-accent: #1f4e8c; --pn-chip: #efece6;
  --pn-shadow: 0 6px 24px rgba(30,25,15,.16); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ppnav, :root:not([data-theme="light"]) .ppnav-tools {
  --pn-bg: #222220; --pn-ink: #ecebe7; --pn-muted: #a8a59d; --pn-line: #36342f; --pn-accent: #9cc2ff; --pn-chip: #2d2b28; --pn-shadow: 0 6px 24px rgba(0,0,0,.55); } }
:root[data-theme="dark"] .ppnav, :root[data-theme="dark"] .ppnav-tools {
  --pn-bg: #222220; --pn-ink: #ecebe7; --pn-muted: #a8a59d; --pn-line: #36342f; --pn-accent: #9cc2ff; --pn-chip: #2d2b28; --pn-shadow: 0 6px 24px rgba(0,0,0,.55); }
html.ppnav-on [data-ppnav-hide] { display: none !important; }
.ppnav { box-sizing: border-box; margin: 0; padding: 0; background: var(--pn-bg); color: var(--pn-ink); border-bottom: 1px solid var(--pn-line);
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: left; position: relative; z-index: 20; }
.ppnav *, .ppnav-tools * { box-sizing: border-box; }
.ppnav-in { max-width: 1280px; margin: 0 auto; padding: 0 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0 18px; min-height: 48px; }
.ppnav a.ppnav-brand { font-size: 17px; font-weight: 700; letter-spacing: -.01em; color: var(--pn-ink); text-decoration: none; padding: 10px 0; margin: 0; border: 0; }
.ppnav-links { display: flex; flex-wrap: wrap; align-items: center; margin: 0; padding: 0; }
.ppnav-links > a.ppnav-a, .ppnav-tools > summary.ppnav-sum { display: block; margin: 0; padding: 13px 11px 10px; border: 0; border-bottom: 3px solid transparent;
  font: 600 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--pn-muted); text-decoration: none; cursor: pointer; white-space: nowrap; background: none; }
.ppnav-links > a.ppnav-a:hover, .ppnav-tools > summary.ppnav-sum:hover { color: var(--pn-ink); }
.ppnav-links > a.ppnav-a[aria-current="page"], .ppnav-tools.ppnav-here > summary.ppnav-sum { color: var(--pn-ink); border-bottom-color: var(--pn-accent); }
.ppnav-tools { position: relative; display: block; margin: 0; padding: 0; border: 0; background: none; }
.ppnav-tools > summary.ppnav-sum { list-style: none; user-select: none; -webkit-user-select: none; }
.ppnav-tools > summary.ppnav-sum::-webkit-details-marker { display: none; }
.ppnav-tools > summary.ppnav-sum::after { content: "▾"; margin-left: 5px; font-size: 11px; }
.ppnav-native > summary.ppnav-sum { padding: 10px 12px 9px; line-height: inherit; font-family: inherit; }
.ppnav-tools > summary.ppnav-sum:focus-visible, .ppnav a:focus-visible, .ppnav-panel a:focus-visible { outline: 2px solid var(--pn-accent); outline-offset: -2px; }
.ppnav-count { display: inline-block; min-width: 18px; margin-left: 6px; padding: 0 5px; border-radius: 9px; background: var(--pn-accent); color: var(--pn-bg);
  font: 700 11px/18px system-ui, sans-serif; text-align: center; vertical-align: 1px; }
.ppnav-count[hidden] { display: none; }
.ppnav-panel { position: absolute; right: 0; top: calc(100% + 4px); z-index: 2147482000; width: 330px; max-width: calc(100vw - 24px); margin: 0; padding: 6px;
  background: var(--pn-bg); color: var(--pn-ink); border: 1px solid var(--pn-line); border-radius: 10px; box-shadow: var(--pn-shadow);
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: left; white-space: normal; }
.ppnav-panel a.ppnav-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 10px; align-items: baseline; margin: 0; padding: 8px 10px; border: 0; border-radius: 7px;
  color: var(--pn-ink); text-decoration: none; font-weight: 400; font-size: 14px; white-space: normal; }
.ppnav-panel a.ppnav-item:hover { background: var(--pn-chip); }
.ppnav-panel a.ppnav-item[aria-current="page"] { background: var(--pn-chip); box-shadow: inset 3px 0 0 var(--pn-accent); }
.ppnav-panel a.ppnav-item b { font-weight: 650; }
.ppnav-panel a.ppnav-item small { grid-column: 1 / -1; font-size: 12.5px; color: var(--pn-muted); }
.ppnav-panel a.ppnav-item i { font-style: normal; font-size: 12px; font-weight: 650; color: var(--pn-accent); white-space: nowrap; }
.ppnav-panel p.ppnav-note { margin: 4px 0 2px; padding: 7px 10px 4px; border-top: 1px solid var(--pn-line); font-size: 12.5px; line-height: 1.4; color: var(--pn-muted); }
.ppnav-panel .ppnav-sep { height: 1px; margin: 4px 0; background: var(--pn-line); }
.ppnav-menu { display: none; }
@media (max-width: 760px) {
  .ppnav-wide { display: none; }
  .ppnav-menu { display: block; }
  .ppnav-menu > summary.ppnav-sum { padding: 13px 4px 10px 11px; }
  .ppnav-in { min-height: 46px; }
}
@media print { .ppnav, .ppnav-tools { display: none !important; } }`;

  function toolItems(withTabs) {  // the links of a panel, counted afresh each time it opens
    const kids = [];
    if (withTabs) {
      for (const [text, href] of TABS) kids.push(el('a', { class: 'ppnav-item', href: url(href) }, el('b', null, text)));
      kids.push(el('div', { class: 'ppnav-sep' }));
    }
    let held = 0;
    for (const [id, text, href, hint, key, word] of TOOLS) {
      const n = key ? stored(key) : 0;
      held += n;
      kids.push(el('a', { class: 'ppnav-item', href: url(href), 'aria-current': id && id === PAGE ? 'page' : null },
        el('b', null, text), n ? el('i', null, `${n} ${word} here`) : null, el('small', null, hint)));
    }
    if (withTabs) {
      kids.push(el('div', { class: 'ppnav-sep' }));
      for (const [id, text, href] of END) kids.push(el('a', { class: 'ppnav-item', href: url(href), 'aria-current': id === PAGE ? 'page' : null }, el('b', null, text)));
    }
    kids.push(el('p', { class: 'ppnav-note' }, held
      ? 'Entries and decisions stay in this browser. Download them on their page and put the files into the team\'s folder.'
      : 'What you enter or decide stays in this browser until you download it on that page.'));
    return kids;
  }
  const held = () => TOOLS.reduce((n, t) => n + (t[4] ? stored(t[4]) : 0), 0);

  function menu(label, cls, withTabs) {  // a <details> that opens a panel of links
    const count = el('span', { class: 'ppnav-count', hidden: true });
    const sum = el('summary', { class: 'ppnav-sum' }, label, count);
    const panel = el('div', { class: 'ppnav-panel' });
    const d = el('details', { class: 'ppnav-tools ' + cls }, sum, panel);
    const refresh = () => { const n = held(); count.textContent = n; count.hidden = !n; count.title = `${n} entries and decisions in this browser`; };
    refresh();
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      panel.replaceChildren(...toolItems(withTabs));
      refresh();
      // keep the panel inside the window: it hangs from the right edge of its button, unless that would cut it off
      panel.style.left = panel.style.right = '';
      if (panel.getBoundingClientRect().left >= 8) return;
      panel.style.right = 'auto';
      panel.style.left = '0px';
      const over = panel.getBoundingClientRect().right - (document.documentElement.clientWidth - 8);
      if (over > 0) panel.style.left = -over + 'px';
    });
    if (['form', 'review', 'search', 'sik'].includes(PAGE)) d.classList.add('ppnav-here');
    return d;
  }
  function closeAll(except) {
    document.querySelectorAll('details.ppnav-tools[open]').forEach(d => { if (d !== except) d.open = false; });
  }
  document.addEventListener('click', e => {
    const inside = e.target instanceof Element ? e.target.closest('details.ppnav-tools') : null;
    closeAll(inside);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('details.ppnav-tools[open]');
    if (open) { open.open = false; const s = open.querySelector('summary'); if (s) s.focus(); }
  });

  function style() {
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // a page with the site header in its markup: add the Tools menu to its <nav>
  function enhance(nav) {
    if (nav.querySelector('details.ppnav-tools')) return;
    const about = [...nav.querySelectorAll('a')].find(a => /#about$/.test(a.getAttribute('href') || ''));
    const tools = menu('Tools', 'ppnav-native', false);
    if (about) nav.insertBefore(tools, about); else nav.append(tools);
    if (![...nav.querySelectorAll('a')].some(a => /how-we-got-here\.html/.test(a.getAttribute('href') || ''))) {
      const a = el('a', { href: url('how-we-got-here.html') }, 'How we got here');
      nav.append(a);
    }
  }
  // every other page: the whole header, before anything else in <body>
  function inject() {
    if (document.querySelector('.ppnav')) return;
    const a = (text, href, current) => el('a', { class: 'ppnav-a', href: url(href), 'aria-current': current ? 'page' : null }, text);
    const wide = el('div', { class: 'ppnav-links ppnav-wide' },
      ...TABS.map(([t, h]) => a(t, h, false)), menu('Tools', '', false), ...END.map(([id, t, h]) => a(t, h, id === PAGE)));
    const narrow = menu('Menu', 'ppnav-menu', true);
    const bar = el('div', { class: 'ppnav' },
      el('div', { class: 'ppnav-in' }, el('a', { class: 'ppnav-brand', href: url('./'), title: 'To the results' }, 'Provenance Pursuit'),
        el('div', { class: 'ppnav-links', role: 'navigation', 'aria-label': 'Site' }, wide, narrow)));
    document.body.prepend(bar);
    // the bar spans the window from its top edge, whatever padding, margin or column width the page gives <body>
    const fit = () => {
      bar.style.margin = '0';
      const r = bar.getBoundingClientRect(), w = document.documentElement.clientWidth;
      const top = Math.max(0, r.top + scrollY), left = Math.max(0, r.left + scrollX), right = Math.max(0, w - (r.right + scrollX));
      bar.style.margin = `${-top}px ${-right}px ${top}px ${-left}px`;
    };
    fit();
    addEventListener('resize', fit);
    addEventListener('load', fit);
    document.addEventListener('DOMContentLoaded', fit);
  }

  const nativeNav = () => document.querySelector('header nav a[data-tab="labels"], header nav a[href$="#labels"]');
  function run() {
    try {
      const n = nativeNav();
      if (n) enhance(n.closest('nav')); else inject();
    } catch (err) {
      document.documentElement.classList.remove('ppnav-on');  // show the pages' own back links again
      console.warn('nav.js:', err);
    }
  }

  document.documentElement.classList.add('ppnav-on');
  style();
  window.ppNav = { page: PAGE, held };
  if (PAGE === 'results' || PAGE === 'how') {       // these have the header in their markup: wait for it
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  } else if (document.body) {
    run();
  } else {                                          // insert the header as soon as <body> opens, so nothing jumps
    const mo = new MutationObserver(() => { if (document.body) { mo.disconnect(); run(); } });
    mo.observe(document.documentElement, { childList: true });
    document.addEventListener('DOMContentLoaded', () => { mo.disconnect(); if (!document.querySelector('.ppnav')) run(); });
  }
})();
