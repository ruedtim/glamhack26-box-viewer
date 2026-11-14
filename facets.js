/* Data sheet facets for the results site: prov_parser/site_facets.js, published as site/facets.js (side session
   «facets», 14 Nov 2026). The marks of SKKG's provenance data sheets as the prov-parser read them
   (https://github.com/kintopp/glamhack26-prov-parser, MIT, © 2026 University of Basel), matched to the labels and works
   by prov_parser/facets.py. data.json «facets.f» is the dictionary: [[key, English name, parser column, "rule"|"llm",
   note, [[value, gloss, merged spellings], …]], …]; «fv» on labels and works are codes into it, counted from 1 over all
   facets in order, negative = an uncertain value. Values in German as in the data sheets, with English glosses; names
   (issuer, owner, place) in their most frequent spelling.

   Hooks in the page (one line each; prov_parser/README.md):
     <script src="facets.js"></script>                         in the head
     ppFacets.setup(data, { labels: {…}, works: {…} })         once the data is loaded, before the first route()
     h = ppFacets.route(h)                                     route(): «labels?…» sets the filters, returns «labels»
   then either (a page with filter hooks)
     facetPass = l => ppFacets.pass('labels', l)               the facets' part of the tab's filter
     facetSummary = () => ppFacets.summary('labels')           once per render: counts and address; returns «2 facets» or ''
   or (a page without them)
     list = ppFacets.apply('labels', list)                     the tab's list after its other filters, before paging
   optional, in the dialogs' facts: ppFacets.fact(label, 'labels'), ppFacets.fact(work, 'works') -> [title, html] | false
   Options per tab: render (redraws the tab, back to its first page), base (the tab's list after its other filters,
   for the counts; needed with pass/summary), spot (selector of the page's place for the panel, e.g. '#lfacets';
   else [data-facets="labels"], else beside grid/more), chips (where the selected values go; default before the grid),
   controls ({name: selector} of the tab's other filters, kept in the address too: a search field, a checkbox, a
   select, a group of radios, or a group of buttons with data-v and aria-pressed), about (a «How to use» link),
   section (default #<tab>), home (true: the tab an empty address shows), hash (default the tab's key).
   Values of a facet combine with OR, facets with AND and with the tab's other filters; each count says how many items
   a value would leave. The address keeps the state: #labels?issuer=sotheby-s&q=Basel&firm=1 (replaceState: no history
   entries). Uses the page's tokens --panel, --ink, --muted, --line, --accent, --chip, --model and --head. */
(() => {
  'use strict';
  const PARSER = '<a href="https://github.com/kintopp/glamhack26-prov-parser" target="_blank" rel="noopener">prov-parser</a>';
  const UNSURE = 'Uncertain: inferred while coding, or read from the photo or the provenance chain';
  const LLMT = 'Filled by a language model from the data sheet\'s description, checked against a quote: verify in the data sheet';
  const LONG = 15, TOP = 8;  // facets with more values (the names) show the TOP most frequent, «Show all» and a find field
  const CSS = `
  .fxwrap { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 16px; align-items: start; }
  .fxwrap > .fx { position: sticky; top: calc(var(--head, 64px) + 10px); max-height: calc(100vh - var(--head, 64px) - 20px);
        overflow: auto; overscroll-behavior: contain; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
  .fx { font-size: 13px; color: var(--ink); }
  .fx-box > summary { position: sticky; top: 0; z-index: 1; background: var(--panel); display: flex; flex-wrap: wrap; gap: 2px 6px;
        align-items: baseline; padding: 9px 12px 8px; font-weight: 600; font-size: 14px; cursor: pointer; border-bottom: 1px solid var(--line); }
  .fx-on { color: var(--accent); font-size: 13px; }
  .fx-in { padding: 2px 12px 10px; }
  .fx-inline .fx-in { padding: 0; }
  .fx-inline .fx-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0 18px; }
  .fx-note { color: var(--muted); font-size: 12px; line-height: 1.4; margin: 6px 0 8px; }
  .fx-tools { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; margin: 0 0 6px; }
  .fx-tools label { font-size: 13px; color: var(--muted); display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
  .fx-clear, .fx-all { font: inherit; font-size: 12px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 6px; padding: 2px 8px; cursor: pointer; }
  .fx-clear[hidden], .fx-all[hidden] { display: none; }
  .fx-g { border-top: 1px solid var(--line); }
  .fx-g > summary { cursor: pointer; padding: 7px 0 5px; font-weight: 600; }
  .fx-gn { float: right; color: var(--accent); font-size: 12px; font-weight: 600; }
  .fx-g ul { list-style: none; margin: 0 0 6px; padding: 0; }
  .fx-g li[hidden] { display: none; }
  .fx-g label { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0 7px; align-items: baseline; padding: 2px 0; cursor: pointer; }
  .fx-g input[type=checkbox] { margin: 0; position: relative; top: 2px; }
  .fx-find { font: inherit; font-size: 12px; width: 100%; padding: 4px 7px; margin: 0 0 4px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); }
  .fx-all { margin: 0 0 8px; }
  .fx-none { color: var(--muted); font-size: 12px; margin: 0 0 8px; }
  .fx-none[hidden], .fx-find[hidden] { display: none; }
  .fx-v { overflow-wrap: anywhere; }
  .fx-gl { color: var(--muted); font-size: 12px; }
  .fx-n { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .fx-g li.zero label { opacity: .45; cursor: default; }
  .fx-llm { font-style: normal; font-size: 10px; font-weight: 700; letter-spacing: .02em; padding: 0 5px; border-radius: 99px;
            border: 1px solid var(--model); color: var(--model); white-space: nowrap; }
  .fx-u { color: var(--model); font-weight: 700; cursor: help; }
  .fx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
  .fx-chips:empty { display: none; }
  .fx-chip { font: inherit; font-size: 12px; border: 1px solid var(--accent); color: var(--accent); background: var(--panel); border-radius: 99px; padding: 2px 9px; cursor: pointer; }
  .fx-chip:hover, .fx-chip:focus-visible { background: var(--chip); }
  @media (max-width: 760px) { .fxwrap { grid-template-columns: minmax(0, 1fr); } .fxwrap > .fx { position: static; max-height: none; } }
  .more[hidden] { display: none; }  /* «Show more» showed under short lists too: .more's display beat the hidden attribute */
  `;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const obj = e => Array.isArray(e) ? e[1] : e;  // works may come as [id, work] entries
  const has = (set, S) => { for (const c of S) if (set.has(c)) return true; return false; };
  const llm = f => f.llm ? ` <i class="fx-llm" title="${esc(LLMT)}">LLM</i>` : '';
  const CODE = {}, TABS = {};
  let F = null, D = null, applying = false;

  function control(sel) {  // read and set one of the tab's other filters through its element and its own events
    const el = sel && document.querySelector(sel);
    if (!el) return null;
    const fire = (x, type) => x.dispatchEvent(new Event(type, { bubbles: true }));
    if (el.matches('input[type=checkbox]')) return {
      def: el.defaultChecked ? '1' : '0', get: () => (el.checked ? '1' : '0'),
      set: v => { if (el.checked !== (v === '1')) { el.checked = v === '1'; fire(el, 'change'); } } };
    if (el.matches('select')) {
      const d = [...el.options].find(o => o.defaultSelected) || el.options[0];
      return { def: slug(d ? d.value : ''), get: () => slug(el.value),
        set: v => { const o = [...el.options].find(x => slug(x.value) === v); if (o && el.value !== o.value) { el.value = o.value; fire(el, 'change'); } } };
    }
    if (el.matches('input, textarea')) return {
      def: el.defaultValue.trim(), get: () => el.value.trim(),
      set: v => { if (el.value.trim() !== v) { el.value = v; fire(el, 'input'); } } };
    const radios = () => [...el.querySelectorAll('input[type=radio]')];
    if (radios().length) {
      const d = radios().find(r => r.defaultChecked) || radios()[0];
      return { def: slug(d.value), get: () => slug((radios().find(r => r.checked) || d).value),
        set: v => { const r = radios().find(x => slug(x.value) === v); if (r && !r.checked) { r.checked = true; fire(r, 'change'); } } };
    }
    const bs = () => [...el.querySelectorAll('button[data-v]')];  // a group of buttons (.seg)
    const pressed = () => bs().find(b => b.getAttribute('aria-pressed') === 'true');
    const d = pressed();
    return { def: slug(d ? d.dataset.v : ''), get: () => slug((pressed() || { dataset: { v: '' } }).dataset.v),
      set: v => { const b = bs().find(x => slug(x.dataset.v) === v); if (b && b !== pressed()) b.click(); } };
  }

  function setup(data, opts) {
    D = data;
    if (!D || !D.facets || !D.facets.f || F) return;
    let c = 1;
    F = D.facets.f.map(([k, n, col, layer, note, vals], i) => ({ k, n, col, llm: layer === 'llm', note, i, long: vals.length > LONG,
      v: vals.map(([v, g, m], j) => { const o = { c, v, g, m: m || [], slug: slug(v), i, j, find: fold([v, g, ...(m || [])].join(' ')) }; CODE[c++] = o; return o; }) }));
    const prep = o => { if (o && o.fv && !o.fxa) { o.fxa = new Set(o.fv.map(Math.abs)); o.fxf = new Set(o.fv.filter(x => x > 0)); } };
    (D.labels || []).forEach(prep);
    Object.values(D.works || {}).forEach(prep);
    const style = document.createElement('style');
    style.id = 'ppfacets-css';
    style.textContent = CSS;
    document.head.append(style);
    for (const [key, o] of Object.entries(opts || {})) {
      const T = TABS[key] = { key, hash: o.hash || key, section: o.section || '#' + key, home: !!o.home, render: o.render || (() => {}),
        base: o.base || null, about: o.about || '', sel: {}, firm: false, ctl: {}, all: {}, find: {} };
      for (const [name, s] of Object.entries(o.controls || {})) { const x = control(s); if (x) T.ctl[name] = x; }
      mount(T, o);
    }
  }

  function mount(T, o) {  // the panel: in the page's spot, else beside the grid in a sticky column
    let spot = document.querySelector(o.spot || `[data-facets="${T.key}"]`);
    const grid = o.grid && document.querySelector(o.grid);
    T.chips = (o.chips && document.querySelector(o.chips)) || document.createElement('div');
    T.chips.classList.add('fx-chips');
    T.inline = !!spot;
    if (!spot) {
      if (!grid) return;
      const wrap = document.createElement('div'), main = document.createElement('div'), more = o.more && document.querySelector(o.more);
      wrap.className = 'fxwrap';
      main.className = 'fxmain';
      spot = document.createElement('aside');
      grid.before(wrap);
      wrap.append(spot, main);
      main.append(T.chips, grid);
      if (more) main.append(more);
    } else if (!T.chips.isConnected) {
      if (grid) grid.before(T.chips); else spot.after(T.chips);
    }
    spot.hidden = false;
    spot.classList.add('fx');
    if (T.inline) spot.classList.add('fx-inline');
    spot.setAttribute('aria-label', `Data sheet facets of the ${T.key}`);
    T.root = spot;
    const items = T.key === 'works' ? Object.values(D.works || {}) : (D.labels || []);
    const n = items.filter(x => x.fv).length;
    const note = T.key === 'works'
      ? `${n.toLocaleString('en')} works with a data sheet: all the marks it describes, also those not placed on the back, as the ${PARSER} read them.`
      : `${n.toLocaleString('en')} of the ${items.length.toLocaleString('en')} labels: the marks the data sheets describe, as the ${PARSER} read the descriptions, and register entries that show such a mark.`;
    const groups = F.map(f => `<details class="fx-g${f.long ? ' fx-long' : ''}" data-i="${f.i}"${!T.inline && f.i < 3 ? ' open' : ''}><summary>${esc(f.n)}${llm(f)}<span class="fx-gn"></span></summary>
      ${f.long ? `<input type="search" class="fx-find" placeholder="Find ${({ issuer: 'a name', owner: 'a name', place: 'a place' })[f.k] || 'a value'} …" aria-label="Find in ${esc(f.n)}">` : ''}
      <ul>${f.v.map(v => { const tip = v.m.length ? (v.v === 'andere' ? '' : 'also written: ') + v.m.join(', ') : f.note;
        return `<li data-j="${v.j}"><label${tip ? ` title="${esc(tip)}"` : ''}><input type="checkbox" value="${v.c}"><span><span class="fx-v">${esc(v.v)}</span>${v.g && v.g !== v.v ? ` <span class="fx-gl">${esc(v.g)}</span>` : ''}</span><span class="fx-n"></span></label></li>`; }).join('')}</ul>
      ${f.long ? '<p class="fx-none" hidden>None among the labels shown.</p><button type="button" class="fx-all"></button>' : ''}</details>`).join('');
    const inner = `<p class="fx-note">${note} Values in German as in the data sheets.${T.about ? ` <a href="${esc(T.about)}">How to use →</a>` : ''}</p>
      <div class="fx-tools"><label title="${esc(UNSURE)}"><input type="checkbox" class="fx-firm"> only certain values</label><button type="button" class="fx-clear" hidden>Clear facets</button></div>
      <div class="fx-groups">${groups}</div>`;
    spot.innerHTML = T.inline ? `<div class="fx-in">${inner}</div>`
      : `<details class="fx-box"><summary>Data sheet facets <span class="fx-on"></span></summary><div class="fx-in">${inner}</div></details>`;
    const box = spot.querySelector('.fx-box');
    if (box) {  // beside the grid: on a phone the panel starts folded, above the cards
      const phone = matchMedia('(max-width: 760px)');
      box.open = !phone.matches;
      phone.addEventListener('change', e => { box.open = !e.matches; });
    }
    spot.addEventListener('change', e => {
      const x = e.target;
      if (x.classList.contains('fx-firm')) T.firm = x.checked;
      else if (x.type === 'checkbox' && CODE[+x.value]) {
        const v = CODE[+x.value], S = T.sel[v.i] || (T.sel[v.i] = new Set());
        if (x.checked) S.add(v.c); else S.delete(v.c);
        if (!S.size) delete T.sel[v.i];
      } else return;
      T.render();
    });
    spot.addEventListener('input', e => {
      if (!e.target.classList.contains('fx-find')) return;
      const g = e.target.closest('.fx-g');
      T.find[+g.dataset.i] = fold(e.target.value.trim());
      shown(T, g);
    });
    spot.addEventListener('click', e => {
      const b = e.target.closest('.fx-all, .fx-clear');
      if (!b) return;
      if (b.classList.contains('fx-clear')) { T.sel = {}; T.render(); return; }
      const g = b.closest('.fx-g'), i = +g.dataset.i;
      T.all[i] = !T.all[i];
      shown(T, g);
    });
    T.chips.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.c) { const v = CODE[+b.dataset.c], S = T.sel[v.i]; if (S) { S.delete(v.c); if (!S.size) delete T.sel[v.i]; } }
      else T.sel = {};
      T.render();
    });
  }

  function shown(T, g) {  // a long list: the TOP values with items, the selected ones, all on «Show all», or those found
    const i = +g.dataset.i, f = F[i], S = T.sel[i], q = T.find[i] || '', all = !!T.all[i];
    const n = li => (T.cnt && T.cnt.get(f.v[+li.dataset.j].c)) || 0, ul = g.querySelector('ul');
    const lis = [...ul.children].sort((a, b) => n(b) - n(a) || a.dataset.j - b.dataset.j);  // most items first
    lis.forEach(li => ul.append(li));
    let live = 0, top = 0;
    lis.forEach(li => {
      const v = f.v[+li.dataset.j], k = n(li), on = !!S && S.has(v.c);
      if (k) live++;
      const show = on || (!!k && (q ? v.find.includes(q) : all || top < TOP));
      if (show && !on && !q && !all) top++;
      li.hidden = !show;
    });
    const none = g.querySelector('.fx-none');
    none.hidden = live > 0 || !!S;
    none.textContent = `None among the ${T.key === 'works' ? 'works' : 'labels'} shown.`;
    g.querySelector('.fx-find').hidden = live <= TOP && !q;  // a find field only where there is something to find
    const b = g.querySelector('.fx-all');
    b.hidden = !!q || live <= TOP;
    b.textContent = all ? 'Show fewer' : `Show all ${live.toLocaleString('en')}`;
  }

  const active = T => Object.entries(T.sel).map(([i, S]) => [+i, S]);
  function passes(T, e, act) {
    const o = obj(e), set = o && (T.firm ? o.fxf : o.fxa);
    return !!set && act.every(([, S]) => has(set, S));
  }

  function pass(key, e) {  // the facets' part of the tab's filter (a page with a facetPass hook)
    const T = TABS[key], act = T ? active(T) : [];
    return !act.length || passes(T, e, act);
  }

  function summary(key) {  // once per render (a page with a facetSummary hook): counts and address; a short text
    const T = TABS[key];
    if (!F || !T || !T.root) return '';
    const act = active(T);
    if (T.base) panel(T, T.base(), act);
    const on = act.reduce((s, [, S]) => s + S.size, 0);
    return on ? `${on} facet${on > 1 ? 's' : ''}` : '';
  }

  function apply(key, base) {  // a page without hooks: the items of its list that pass the facets; panel and address
    const T = TABS[key];
    if (!F || !T || !T.root) return base;
    const act = active(T);
    panel(T, base, act);
    return act.length ? base.filter(e => passes(T, e, act)) : base;
  }

  function panel(T, base, act) {  // counts: for a value, the items that pass every other facet and have it
    const cnt = T.cnt = new Map();
    for (const e of base) {
      const o = obj(e), set = o && (T.firm ? o.fxf : o.fxa);
      if (!set) continue;
      let bad = 0, miss = -1;
      for (const [i, S] of act) if (!has(set, S)) { miss = i; if (++bad > 1) break; }
      if (bad > 1) continue;
      for (const c of set) if (!bad || CODE[c].i === miss) cnt.set(c, (cnt.get(c) || 0) + 1);
    }
    T.root.querySelectorAll('.fx-g').forEach(g => {
      const S = T.sel[+g.dataset.i];
      g.querySelectorAll('input[type=checkbox]').forEach(x => {
        const c = +x.value, k = cnt.get(c) || 0, on = !!S && S.has(c);
        x.checked = on;
        x.disabled = !k && !on;
        x.closest('li').classList.toggle('zero', !k && !on);
        x.closest('label').querySelector('.fx-n').textContent = k.toLocaleString('en');
      });
      g.querySelector('.fx-gn').textContent = S ? `${S.size} on` : '';
      if (S) g.open = true;
      if (g.classList.contains('fx-long')) shown(T, g);
    });
    const on = act.reduce((s, [, S]) => s + S.size, 0);
    const head = T.root.querySelector('.fx-on');
    if (head) head.textContent = on ? `· ${on} on` : '';
    T.root.querySelector('.fx-firm').checked = T.firm;
    T.root.querySelector('.fx-clear').hidden = !on;
    T.chips.innerHTML = on ? act.map(([i, S]) => [...S].map(c => { const v = CODE[c];
      return `<button type="button" class="fx-chip" data-c="${c}" title="Remove${v.g && v.g !== v.v ? ': ' + esc(v.g) : ''}">${esc(F[i].n)}: ${esc(v.v)} ✕</button>`; }).join('')).join('')
      + (on > 1 ? '<button type="button" class="fx-chip">Clear facets</button>' : '') : '';
    sync(T);
  }

  function query(T) {  // the tab's filters for the address: its other filters where they differ from the page's defaults
    const p = [];
    for (const [name, x] of Object.entries(T.ctl)) { const v = x.get(); if (v !== x.def) p.push(name + '=' + encodeURIComponent(v)); }
    for (const f of F) { const S = T.sel[f.i]; if (S && S.size) p.push(f.k + '=' + f.v.filter(v => S.has(v.c)).map(v => v.slug).join(',')); }
    if (T.firm) p.push('firm=1');
    return p.join('&');
  }

  function sync(T) {  // the address follows the filters while the tab is shown at its own address
    if (applying) return;
    const sec = document.querySelector(T.section);
    if (!sec || sec.hidden) return;
    const raw = location.hash.slice(1), at = decodeURIComponent(raw.split('?')[0]);
    if (at !== T.hash && !(at === '' && T.home)) return;  // a dialog or another part: leave the address alone
    const q = query(T), want = q ? `#${T.hash}?${q}` : raw.includes('?') ? `#${T.hash}` : '';
    if (want && want !== location.hash) history.replaceState(history.state, '', want);
  }

  function route(h) {  // «labels?…»: that tab's filters from the address (what it does not name is reset); returns «labels»
    const i = h.indexOf('?');
    if (i < 0) return h;
    const name = h.slice(0, i), T = Object.values(TABS).find(x => x.hash === name);
    if (T && F) {
      const raw = location.hash.slice(1), p = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
      applying = true;
      try {
        T.firm = p.get('firm') === '1';
        T.sel = {};
        for (const f of F) {
          const want = (p.get(f.k) || '').split(',').filter(Boolean), S = new Set(f.v.filter(v => want.includes(v.slug)).map(v => v.c));
          if (S.size) T.sel[f.i] = S;
        }
        for (const [cname, x] of Object.entries(T.ctl)) x.set(p.has(cname) ? p.get(cname) : x.def);
      } finally { applying = false; }
    }
    return name;
  }

  function fact(o, key = 'labels') {  // a dialog's facts: the item's facet values, each a link to the tab filtered by it
    const T = TABS[key];
    if (!F || !o || !o.fv) return false;
    const by = {};
    o.fv.forEach(x => { const v = CODE[Math.abs(x)]; if (v) (by[v.i] || (by[v.i] = [])).push([v, x < 0]); });
    const hash = T ? T.hash : key;
    const rows = F.filter(f => by[f.i]).map(f => `${esc(f.n)}${llm(f)}: ` + by[f.i].map(([v, u]) =>
      `<a href="#${esc(hash)}?${f.k}=${v.slug}" title="All ${esc(key)} with this value">${esc(v.v)}</a>${v.g && v.g !== v.v ? ` <span class="fx-gl">${esc(v.g)}</span>` : ''}${u ? `<sup class="fx-u" title="${esc(UNSURE)}">?</sup>` : ''}`).join(', '));
    const how = key === 'works' ? `All the marks of its data sheet, as the ${PARSER} read them`
      : `The data sheet's description${o.src === 'data sheet' ? '' : ' of the same mark'}, as the ${PARSER} read it`;
    return ['Data sheet facets', `${rows.join('<br>')}<br><span class="fx-gl">${how}.</span>`];
  }

  window.ppFacets = { setup, route, pass, summary, apply, fact };
})();
