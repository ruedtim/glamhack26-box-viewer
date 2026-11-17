/* Zoom and box editor for the Provenance Pursuit pages – GLAMhack 2026, challenge 304.
 *
 * Labels on the backs are often small, so every place where a box is drawn, checked or changed zooms into the photograph:
 * - ppBoxZoom.edit(opts): a dialog over the whole window for one box. Scroll or pinch to zoom (also −, +, «Whole image»,
 *   «To the box» and the keys + − 0 B); drag across the picture to draw the box, drag its corners or edges to change it,
 *   drag inside it to move it (Shift + drag always draws a new one); hold Space, use the middle mouse button or switch to
 *   «Move picture» to move the picture (two fingers on a touch screen). Used by the results site (draw a missing label),
 *   the entry form (check and redraw a box), the review page (redraw the model's box) and the search by photo (redraw a
 *   hit's box, crop the own photo).
 * - ppBoxZoom.view(el, opts): turns an element with a size into a zoomable picture with boxes (the review page): + and −
 *   in its corner, a double-click, a pinch or Ctrl/⌘ + scroll zoom, a drag moves; plain scrolling still scrolls the page.
 * The picture comes from the IIIF image server: one rendering of the whole image, and, once zoomed in further than that
 * rendering holds, the visible part at the resolution the screen needs (asked for when the view comes to rest; nothing is
 * copied). opts.img shows another image instead (the search by photo's own photo, at full size).
 * Boxes are [x, y, w, h] in pixels of the original image.
 *
 * Include once per page: <script src="boxzoom.js"></script>   (label-search: ../boxzoom.js)
 *
 * edit(opts): { iiif | img, size: [W, H], title, legend (HTML, the page's own text), shapes, box, focus, save, ready,
 *               empty, extra, links, onSave(box), onClose() }
 *   shapes  [{ box, color, dashed, title }]: boxes shown for orientation, not editable
 *   box     the box to start from (it can be changed at once), or null to draw a new one
 *   focus   the part of the image to start on (default: around the box, else the whole image)
 *   save    the main button's text, or (box, changed) => text; ready: (box, changed) => whether it can be pressed
 *           (default: a box that differs from the one it started with)
 *   extra   [{ text, title, onClick(box) }]: more buttons (the dialog closes first); links [{ text, href, title }]
 * view(el, opts): { iiif | img, size, shapes, start (the part to show first) } → { set(opts), destroy() }
 */
(() => {
  if (window.ppBoxZoom) return;
  const NS = 'http://www.w3.org/2000/svg';
  const BASE = 1600;      // the rendering of the whole image: its longest side
  const DETAIL = 2800;    // the longest side asked for when zoomed in
  const CLOSEST = 10;     // the closest zoom: screen pixels per pixel of the original image
  const STEP = 1.6;       // one press of + or −
  const HANDLES = [['nw', 0, 0], ['n', .5, 0], ['ne', 1, 0], ['e', 1, .5], ['se', 1, 1], ['s', .5, 1], ['sw', 0, 1], ['w', 0, .5]];
  const CURSOR = { move: 'move', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize',
                   nw: 'nwse-resize', se: 'nwse-resize' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  const make = (name, attrs = {}) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const baseUrl = iiif => `${iiif}/full/!${BASE},${BASE}/0/default.jpg`;
  function around(b, W, H) {  // a box with its surroundings: the part of the image a box is checked in
    const m = Math.max(b[2], b[3]) * 0.8 + Math.max(W, H) * 0.015;
    const x0 = Math.max(0, b[0] - m), y0 = Math.max(0, b[1] - m), x1 = Math.min(W, b[0] + b[2] + m), y1 = Math.min(H, b[1] + b[3] + m);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, W, H];
  }

  // ---------------------------------------------------------------- style (the colours of the results site)
  const T = (bg, ink, mute, line, edge, accent, on, ok, stage) =>
    `--ppbz-bg:${bg};--ppbz-ink:${ink};--ppbz-mute:${mute};--ppbz-line:${line};--ppbz-edge:${edge};--ppbz-accent:${accent};--ppbz-on:${on};--ppbz-ok:${ok};--ppbz-stage:${stage};`;
  const LIGHT = T('#fff', '#1d1d1b', '#6b6860', '#e2ded6', '#cbc6bb', '#1f4e8c', '#fff', '#1a7f4b', '#e4e1da');
  const DARK = T('#222220', '#ecebe7', '#a8a59d', '#36342f', '#4d4a43', '#9cc2ff', '#171716', '#2b9a5c', '#121211');
  const css = `
.ppbz-theme{${LIGHT}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ppbz-theme{${DARK}}}
:root[data-theme="dark"] .ppbz-theme{${DARK}}
.ppbz{position:absolute;inset:0;overflow:hidden;background:var(--ppbz-stage,#e4e1da);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;outline:none}
.ppbz.ppbz-move{cursor:grab!important}.ppbz.ppbz-grabbing{cursor:grabbing!important}
.ppbz svg{position:absolute;inset:0;display:block;width:100%;height:100%}
.ppbz-under{fill:none;stroke:rgba(0,0,0,.6);stroke-width:4px;vector-effect:non-scaling-stroke;pointer-events:none}
.ppbz-shape{fill:none;stroke-width:2px;vector-effect:non-scaling-stroke}
.ppbz-dashed{stroke-dasharray:7 5}
.ppbz-box{fill:rgba(48,209,88,.05);stroke:#30d158;stroke-width:2.5px;vector-effect:non-scaling-stroke;pointer-events:none}
.ppbz-thick{stroke-width:5.5px}
.ppbz-grip{fill:#fff;stroke:#145c2c;stroke-width:1.5px;vector-effect:non-scaling-stroke;pointer-events:none}
.ppbz-note{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:3px 9px;border-radius:99px;background:rgba(0,0,0,.66);color:#fff;font:12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;pointer-events:none}
.ppbz-note.ppbz-bad{background:rgba(150,30,20,.88)}
.ppbz-corner{position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:4px;z-index:1}
.ppbz-corner button{width:32px;height:32px;padding:0;margin:0;border-radius:6px;border:1px solid rgba(0,0,0,.22);background:rgba(255,255,255,.94);color:#1d1d1b;font:600 18px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.ppbz-corner button:hover{background:#fff}
.ppbz-corner button:focus-visible{outline:2px solid #1f4e8c;outline-offset:1px}
.ppbz-dlg{box-sizing:border-box;width:min(1500px,calc(100vw - 24px));height:calc(100vh - 24px);max-width:none;max-height:none;margin:auto;padding:0;
  border:1px solid var(--ppbz-line);border-radius:10px;background:var(--ppbz-bg);color:var(--ppbz-ink);overflow:hidden;
  font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)}
@supports (height:100dvh){.ppbz-dlg{height:calc(100dvh - 24px)}}
.ppbz-dlg[open]{display:flex;flex-direction:column}
.ppbz-dlg::backdrop{background:rgba(0,0,0,.55)}
.ppbz-dlg *{box-sizing:border-box}
.ppbz-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:10px 14px;border-bottom:1px solid var(--ppbz-line)}
.ppbz-what{flex:1 1 340px;min-width:0}
.ppbz-title{display:block;font-size:15px;font-weight:700;overflow-wrap:anywhere}
.ppbz-legend,.ppbz-help{display:block;font-size:12.5px;color:var(--ppbz-mute);margin-top:2px}
.ppbz-legend b{font-weight:700}
.ppbz-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.ppbz-dlg button{font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0;padding:7px 11px;border-radius:6px;border:1px solid var(--ppbz-edge);
  background:var(--ppbz-bg);color:var(--ppbz-ink);cursor:pointer;white-space:nowrap}
.ppbz-dlg button:hover:not(:disabled){border-color:var(--ppbz-accent)}
.ppbz-dlg button:focus-visible{outline:2px solid var(--ppbz-accent);outline-offset:2px}
.ppbz-dlg button[aria-pressed="true"]{background:var(--ppbz-accent);border-color:var(--ppbz-accent);color:var(--ppbz-on)}
.ppbz-dlg button:disabled{opacity:.45;cursor:default}
.ppbz-seg{display:inline-flex}
.ppbz-seg button:not(:first-child){margin-left:-1px;border-top-left-radius:0;border-bottom-left-radius:0}
.ppbz-seg button:not(:last-child){border-top-right-radius:0;border-bottom-right-radius:0}
.ppbz-level{min-width:46px;font-size:12px;color:var(--ppbz-mute);text-align:right;font-variant-numeric:tabular-nums}
.ppbz-view{position:relative;flex:1 1 auto;min-height:140px;outline:none}
.ppbz-view:focus-visible{outline:2px solid var(--ppbz-accent);outline-offset:-2px}
.ppbz-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:9px 14px;border-top:1px solid var(--ppbz-line)}
.ppbz-info{flex:1 1 260px;font-size:13px;color:var(--ppbz-mute);font-variant-numeric:tabular-nums}
.ppbz-links{font-size:13px}.ppbz-links a{color:var(--ppbz-accent)}
.ppbz-btns{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
.ppbz-dlg .ppbz-save{background:var(--ppbz-ok);border-color:var(--ppbz-ok);color:#fff}
@media (max-width:700px){
  .ppbz-dlg{width:100vw;height:100vh;border:0;border-radius:0}
  @supports (height:100dvh){.ppbz-dlg{height:100dvh}}
  .ppbz-head,.ppbz-foot{padding:8px 10px}
  .ppbz-help,.ppbz-txt{display:none}
  .ppbz-dlg button{padding:7px 9px}
}
@media print{.ppbz-corner{display:none}}`;
  let styled = false;
  function style() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- the zoomable picture
  // The view: its centre (cx, cy) in pixels of the original image and its scale s (screen pixels per original pixel);
  // the SVG's viewBox shows exactly that, so boxes keep their thin lines at every zoom.
  // o.wheel 'ctrl': scrolling zooms only with Ctrl/⌘ (or a pinch), else it scrolls the page.
  // o.tool(point, event): a drag that starts here does something else than moving the picture ({move, end, cancel});
  // o.panning(): whether a drag moves the picture now; o.hover(point, event): the pointer moves without a button.
  function picture(host, o = {}) {
    style();
    const el = document.createElement('div');
    el.className = 'ppbz';
    const svg = make('svg', { 'aria-hidden': 'true' }), gImg = make('g'), gShapes = make('g'), top = make('g');
    svg.append(gImg, gShapes, top);
    const note = document.createElement('div');
    note.className = 'ppbz-note';
    note.hidden = true;
    el.append(svg, note);
    host.append(el);
    let W = 1, H = 1, ew = 0, eh = 0, cx = .5, cy = .5, s = 1, src = '', iiif = '', want = null, anim = 0, timer = 0, n = 0, shown = 0;
    let have = null, baseState = 'none';  // have: [x0, y0, x1, y1, scale] of the sharp part on show
    const z = { el, top, onRender: null };

    const measure = () => { const r = el.getBoundingClientRect(); ew = r.width; eh = r.height; return ew > 0 && eh > 0; };
    const fitScale = () => Math.min(ew / W, eh / H);
    const limit = v => Math.min(Math.max(CLOSEST, fitScale() * 2), Math.max(fitScale() * 0.8, v));
    function clamp() {  // the picture never leaves the view: at most 15 % of the view lies beside it
      s = limit(s);
      const hw = ew / 2 / s, hh = eh / 2 / s;
      cx = 2 * hw >= W ? W / 2 : Math.min(W - 0.7 * hw, Math.max(0.7 * hw, cx));
      cy = 2 * hh >= H ? H / 2 : Math.min(H - 0.7 * hh, Math.max(0.7 * hh, cy));
    }
    function render() {
      if (!ew) return;
      clamp();
      svg.setAttribute('viewBox', `${cx - ew / 2 / s} ${cy - eh / 2 / s} ${ew / s} ${eh / s}`);
      if (z.onRender) z.onRender(s);
      clearTimeout(timer);
      timer = setTimeout(sharpen, 180);
    }
    let late = 0, target = null;  // late: a timer finishes the movement where no frames are drawn (a window in the background)
    function stop() { if (anim) cancelAnimationFrame(anim); anim = 0; clearTimeout(late); target = null; }
    function settle() { if (target) { const t = target; stop(); [cx, cy, s] = t; } }  // a movement under way: at its end at once
    function go(x, y, scale, smooth) {  // to this view, in a short movement for a button or a double-click
      stop();
      scale = limit(scale);
      const end = () => { stop(); cx = x; cy = y; s = scale; render(); };
      if (!smooth || reduced() || !ew) { end(); return; }
      target = [x, y, scale];
      const a = [cx, cy, Math.log(s)], b = [x, y, Math.log(scale)], t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / 220), k = 1 - Math.pow(1 - t, 3);
        if (t >= 1) { end(); return; }
        cx = a[0] + (b[0] - a[0]) * k; cy = a[1] + (b[1] - a[1]) * k; s = Math.exp(a[2] + (b[2] - a[2]) * k);
        render();
        anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
      late = setTimeout(end, 320);
    }
    function fit(b, smooth) {  // show the region b = [x, y, w, h] whole, as large as the view allows
      if (!measure()) { want = b; return; }
      go(b[0] + b[2] / 2, b[1] + b[3] / 2, Math.min(ew / Math.max(b[2], 1), eh / Math.max(b[3], 1)), smooth);
    }
    function zoomAt(f, X, Y, smooth) {  // zoom by f; the point under (X, Y) on the screen stays where it is
      if (!ew) return;
      settle();  // + pressed twice quickly: twice the step
      const r = el.getBoundingClientRect(), px = (X ?? r.left + ew / 2) - r.left - ew / 2, py = (Y ?? r.top + eh / 2) - r.top - eh / 2;
      const ix = cx + px / s, iy = cy + py / s, ns = limit(s * f);
      go(ix - px / ns, iy - py / ns, ns, smooth);
    }
    function panBy(dx, dy) { settle(); cx -= dx / s; cy -= dy / s; render(); }  // in screen pixels: the picture follows the pointer
    z.at = (X, Y) => { const r = el.getBoundingClientRect(); return [cx + (X - r.left - ew / 2) / s, cy + (Y - r.top - eh / 2) / s]; };
    z.scale = () => s;
    z.rel = () => s / fitScale();
    z.size = () => [W, H];
    z.fit = fit;
    z.fitAll = smooth => fit([0, 0, W, H], smooth);
    z.zoomBy = (f, smooth) => zoomAt(f, null, null, smooth);
    z.panBy = panBy;

    // the picture: the whole image first, then the visible part sharper (IIIF)
    function say(text, bad) { note.textContent = text; note.hidden = !text; note.classList.toggle('ppbz-bad', !!bad); }
    function status() {
      if (baseState === 'error') return say('The image could not be loaded from the image server.', true);
      if (baseState === 'loading') return say('Loading the image …');
      say(gImg.querySelector('image[data-n]:not([data-ok])') ? 'Loading the details …' : '');
    }
    function setImage(o2) {
      gImg.replaceChildren();
      have = null; shown = 0; n++;
      const im = make('image', { x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' });
      baseState = 'loading';
      im.addEventListener('load', () => { if (im.isConnected) { baseState = 'ok'; status(); } }, { once: true });
      im.addEventListener('error', () => { if (im.isConnected) { baseState = 'error'; status(); } }, { once: true });
      im.setAttribute('href', o2.img || baseUrl(o2.iiif));
      gImg.append(im);
      status();
    }
    function sharpen() {  // once at rest: the visible part (and a margin) at the resolution the screen needs
      if (!iiif || !ew) return;
      const need = s * Math.min(window.devicePixelRatio || 1, 2), k = Math.min(1, need);
      if (need <= Math.min(1, BASE / Math.max(W, H)) * 1.25) return;  // the whole rendering is sharp enough
      const hw = ew / 2 / s, hh = eh / 2 / s;
      const vis = [Math.max(0, cx - hw), Math.max(0, cy - hh), Math.min(W, cx + hw), Math.min(H, cy + hh)];
      if (vis[2] <= vis[0] || vis[3] <= vis[1]) return;
      if (have && have[0] <= vis[0] + 1 && have[1] <= vis[1] + 1 && have[2] >= vis[2] - 1 && have[3] >= vis[3] - 1 && have[4] >= k * 0.8) return;
      const x0 = Math.max(0, Math.floor(cx - hw * 1.5)), y0 = Math.max(0, Math.floor(cy - hh * 1.5));
      const x1 = Math.min(W, Math.ceil(cx + hw * 1.5)), y1 = Math.min(H, Math.ceil(cy + hh * 1.5));
      const rw = x1 - x0, rh = y1 - y0, f = Math.min(k, DETAIL / Math.max(rw, rh));
      const tw = Math.max(1, Math.round(rw * f)), th = Math.max(1, Math.round(rh * f));
      const size = tw >= rw && th >= rh ? 'max' : `!${tw},${th}`;  // never more than the original (IIIF 3 does not enlarge)
      const id = ++n, im = make('image', { x: x0, y: y0, width: rw, height: rh, preserveAspectRatio: 'none', 'data-n': id });
      im.addEventListener('load', () => {
        if (!im.isConnected) return;
        im.dataset.ok = '1';
        if (id < shown) im.remove();  // a newer part came first
        else {
          shown = id;
          have = [x0, y0, x1, y1, Math.min(1, f)];
          gImg.querySelectorAll('image[data-n]').forEach(x => { if (+x.dataset.n < id) x.remove(); });
        }
        status();
      }, { once: true });
      im.addEventListener('error', () => { im.remove(); status(); }, { once: true });
      im.setAttribute('href', `${iiif}/${x0},${y0},${rw},${rh}/${size}/0/default.jpg`);
      gImg.append(im);
      // at most two parts on their way: an older one still loading is dropped
      gImg.querySelectorAll('image[data-n]:not([data-ok])').forEach(x => { if (+x.dataset.n < id - 1) x.remove(); });
      status();
    }
    z.shapes = list => {
      gShapes.replaceChildren();
      (list || []).forEach(sh => {
        if (!sh || !sh.box) return;
        const a = { x: sh.box[0], y: sh.box[1], width: Math.max(sh.box[2], 1), height: Math.max(sh.box[3], 1) };
        const r = make('rect', { ...a, class: 'ppbz-shape' + (sh.dashed ? ' ppbz-dashed' : ''), style: `stroke:${sh.color || '#64d2ff'}` });
        if (sh.title) { const t = make('title'); t.textContent = sh.title; r.append(t); }
        gShapes.append(make('rect', { ...a, class: 'ppbz-under' }), r);
      });
    };
    z.load = o2 => {  // { iiif | img, size, shapes, start }
      const key = o2.img || o2.iiif;
      if (key !== src) {
        src = key; iiif = o2.img ? '' : o2.iiif;
        [W, H] = o2.size;
        setImage(o2);
      }
      z.shapes(o2.shapes);
      fit(o2.start || [0, 0, W, H], false);
      sharpen();  // at once, not only once the view rests: the first look is sharp sooner
    };

    // moving and zooming: scroll, pinch, drag, double-click
    el.addEventListener('wheel', e => {
      if (o.wheel === 'ctrl' && !e.ctrlKey && !e.metaKey) return;  // the page scrolls
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY;
      zoomAt(Math.min(2, Math.max(0.5, Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0022)))), e.clientX, e.clientY);
    }, { passive: false });
    el.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(e.shiftKey ? 1 / 2 : 2, e.clientX, e.clientY, true); });
    const ptrs = new Map();
    let g = null;  // the gesture under way: pan, pinch, or the tool's
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;  // the right button keeps its menu
      stop();
      if (o.focus) o.focus();
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
      e.preventDefault();
      if (ptrs.size === 2) {  // a second finger: pinch and move; what the first one was drawing is dropped
        if (g && g.k === 'tool' && g.cancel) g.cancel();
        const [a, b] = [...ptrs.values()];
        g = { k: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
        return;
      }
      if (ptrs.size > 2) return;
      const t = e.button === 0 && o.tool && !(o.panning && o.panning()) ? o.tool(z.at(e.clientX, e.clientY), e) : null;
      g = t ? { k: 'tool', ...t } : { k: 'pan', p: [e.clientX, e.clientY] };
      if (!t) el.classList.add('ppbz-grabbing');
    });
    el.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) { if (o.hover && !g) o.hover(z.at(e.clientX, e.clientY), e); return; }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (!g) return;
      if (g.k === 'pinch') {
        if (ptrs.size < 2) return;
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        cx -= (m[0] - g.m[0]) / s; cy -= (m[1] - g.m[1]) / s;
        zoomAt(d / g.d, m[0], m[1]);
        g.d = d; g.m = m;
      } else if (g.k === 'pan') {
        panBy(e.clientX - g.p[0], e.clientY - g.p[1]);
        g.p = [e.clientX, e.clientY];
      } else if (g.move) g.move(z.at(e.clientX, e.clientY), e);
    });
    function up(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (g && g.k === 'tool') {
        if (e.type === 'pointercancel') { if (g.cancel) g.cancel(); } else if (g.end) g.end(z.at(e.clientX, e.clientY), e);
        g = null;
      } else if (g && g.k === 'pinch' && ptrs.size === 1) g = { k: 'pan', p: [...ptrs.values()][0] };
      if (!ptrs.size) { g = null; el.classList.remove('ppbz-grabbing'); }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);

    const ro = new ResizeObserver(() => {
      if (!measure()) return;
      if (want) { const b = want; want = null; fit(b, false); } else render();
    });
    ro.observe(el);
    z.destroy = () => { ro.disconnect(); stop(); clearTimeout(timer); el.remove(); };
    return z;
  }

  // ---------------------------------------------------------------- the zoomable picture in a page (review page)
  function view(host, o = {}) {
    const z = picture(host, { wheel: 'ctrl' });
    host.classList.add('ppbz-theme');
    z.el.title = 'Zoom: + and − (top right), double-click, pinch, or Ctrl/⌘ + scroll; drag to move';
    const bar = document.createElement('div');
    bar.className = 'ppbz-corner';
    bar.innerHTML = '<button type="button" data-z="in" title="Zoom in (also: double-click, pinch, Ctrl/⌘ + scroll)" aria-label="Zoom in">+</button>'
      + '<button type="button" data-z="out" title="Zoom out (Shift + double-click)" aria-label="Zoom out">−</button>'
      + '<button type="button" data-z="home" title="Back to the first view" aria-label="Back to the first view">⤢</button>';
    z.el.append(bar);
    ['pointerdown', 'dblclick', 'wheel'].forEach(t => bar.addEventListener(t, e => e.stopPropagation()));  // the buttons, not the picture
    let start = null, startScale = 0;
    bar.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.z === 'in') z.zoomBy(STEP, true);
      else if (b.dataset.z === 'out') z.zoomBy(1 / STEP, true);
      else if (start) z.fit(start, true);
    });
    // on a touch screen a finger scrolls the page as long as the picture is as it came; zoomed in, it moves the picture
    z.onRender = sc => {
      if (!startScale) startScale = sc;
      z.el.style.touchAction = sc > startScale * 1.05 ? 'none' : 'pan-y';
    };
    const api = {
      set(o2) { start = o2.start || [0, 0, o2.size[0], o2.size[1]]; startScale = 0; z.load({ ...o2, start }); },
      destroy() { z.destroy(); host.classList.remove('ppbz-theme'); },
    };
    if (o.size) api.set(o);
    return api;
  }

  // ---------------------------------------------------------------- the box editor
  function edit(o) {
    style();
    const [W, H] = o.size;
    const d = document.createElement('dialog');
    d.className = 'ppbz-dlg ppbz-theme';
    d.setAttribute('aria-label', o.title || 'Box');
    const touch = coarse();
    d.innerHTML = `<div class="ppbz-head"><div class="ppbz-what"><b class="ppbz-title"></b><span class="ppbz-legend"></span>
      <span class="ppbz-help">${touch ? 'Pinch to zoom, two fingers move the picture. Drag across the picture to draw the box; drag its corners or edges to change it.'
        : 'Scroll or pinch to zoom. Drag across the picture to draw the box; drag its corners or edges to change it, inside it to move it. Space + drag moves the picture.'}</span></div>
      <div class="ppbz-bar" role="toolbar" aria-label="Zoom and tools">
        <span class="ppbz-seg"><button type="button" data-mode="draw" aria-pressed="true" title="Drag to draw or change the box (D)">▭<span class="ppbz-txt"> Draw box</span></button><button type="button" data-mode="move" aria-pressed="false" title="Drag to move the picture (M, or hold Space)">✋<span class="ppbz-txt"> Move picture</span></button></span>
        <span class="ppbz-seg"><button type="button" data-z="out" title="Zoom out (−)" aria-label="Zoom out">−</button><button type="button" data-z="in" title="Zoom in (+)" aria-label="Zoom in">+</button></span>
        <button type="button" data-z="fit" title="Show the whole image (0)">⤢<span class="ppbz-txt"> Whole image</span></button>
        <button type="button" data-z="box" title="Zoom to the box (B)">⌖<span class="ppbz-txt"> To the box</span></button>
        <span class="ppbz-level" title="Zoom: 100 % shows the original image pixel for pixel"></span></div></div>
      <div class="ppbz-view" tabindex="0" role="application" aria-roledescription="box editor"></div>
      <div class="ppbz-foot"><span class="ppbz-info" role="status"></span><span class="ppbz-links"></span>
        <span class="ppbz-btns"><button type="button" class="ppbz-cancel">Cancel</button><button type="button" class="ppbz-save"></button></span></div>`;
    const $ = s => d.querySelector(s);
    $('.ppbz-title').textContent = o.title || '';
    $('.ppbz-legend').innerHTML = o.legend || '';
    $('.ppbz-view').setAttribute('aria-label', `${o.title || 'Image'}: draw the box with the mouse or a finger; + and − zoom, arrow keys move the picture`);
    $('.ppbz-links').innerHTML = (o.links || []).map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener"${l.title ? ` title="${esc(l.title)}"` : ''}>${esc(l.text)}</a>`).join(' · ');
    const view = $('.ppbz-view'), save = $('.ppbz-save'), info = $('.ppbz-info'), level = $('.ppbz-level'), toBoxBtn = $('[data-z="box"]');
    (o.extra || []).forEach(x => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = x.text;
      if (x.title) b.title = x.title;
      b.addEventListener('click', () => { const v = box && box.slice(); d.close(); x.onClick(v); });
      save.before(b);
    });
    document.body.append(d);

    const fix = b => {  // whole pixels, inside the image
      const x0 = Math.min(W, Math.max(0, Math.round(b[0]))), y0 = Math.min(H, Math.max(0, Math.round(b[1])));
      const x1 = Math.min(W, Math.max(0, Math.round(b[0] + b[2]))), y1 = Math.min(H, Math.max(0, Math.round(b[1] + b[3])));
      return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
    };
    let box = o.box ? fix(o.box) : null, mode = 'draw', space = false;
    const first = box ? box.join() : '';
    const tiny = b => !b || b[2] < 3 || b[3] < 3;
    const tol = e => (e.pointerType === 'touch' ? 18 : 8) / z.scale();
    function grip(p, t) {  // which part of the box is under the point: a corner, an edge, the inside, or nothing
      if (!box) return null;
      const [x, y, w, h] = box, x1 = x + w, y1 = y + h;
      if (p[0] < x - t || p[0] > x1 + t || p[1] < y - t || p[1] > y1 + t) return null;
      const dw = Math.abs(p[0] - x), de = Math.abs(p[0] - x1), dn = Math.abs(p[1] - y), ds = Math.abs(p[1] - y1);
      const hx = Math.min(dw, de) <= t ? (dw <= de ? 'w' : 'e') : '', hy = Math.min(dn, ds) <= t ? (dn <= ds ? 'n' : 's') : '';
      return hy + hx || 'move';
    }
    function tool(p, e) {
      const was = box && box.slice(), x0 = e.clientX, y0 = e.clientY, back = () => { box = was; draw(); };
      const h = e.shiftKey ? null : grip(p, tol(e));
      if (h === 'move') {
        const off = [p[0] - box[0], p[1] - box[1]];
        return { move: q => { box = [Math.min(W - was[2], Math.max(0, Math.round(q[0] - off[0]))), Math.min(H - was[3], Math.max(0, Math.round(q[1] - off[1]))), was[2], was[3]]; draw(); },
                 cancel: back };
      }
      if (h) {
        return { move: q => {
          let [a, b, c, f] = [was[0], was[1], was[0] + was[2], was[1] + was[3]];
          if (h.includes('w')) a = q[0]; else if (h.includes('e')) c = q[0];
          if (h.includes('n')) b = q[1]; else if (h.includes('s')) f = q[1];
          box = fix([Math.min(a, c), Math.min(b, f), Math.abs(c - a), Math.abs(f - b)]);
          draw();
        }, end: () => { if (tiny(box)) back(); }, cancel: back };
      }
      let moved = false;  // a new box from here; a click without dragging leaves the box as it is
      return {
        move: (q, ev) => {
          if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
          moved = true;
          box = fix([Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])]);
          draw();
        },
        end: () => { if (moved && tiny(box)) back(); },
        cancel: back,
      };
    }
    function hover(p, e) {  // the pointer says what a drag would do (moving the picture: the class ppbz-move says it)
      if (mode === 'move' || space) return;
      const h = e.shiftKey ? null : grip(p, tol(e));
      z.el.style.cursor = h ? CURSOR[h] : 'crosshair';
    }
    const z = picture(view, { wheel: 'always', tool, hover, panning: () => mode === 'move' || space,
                              focus: () => view.focus({ preventScroll: true }) });
    z.el.style.cursor = 'crosshair';
    function draw() {  // the box with its handles, the numbers under the picture and the main button
      const g = z.top, sc = z.scale();
      g.replaceChildren();
      if (box) {
        const [x, y, w, h] = box, a = { x, y, width: Math.max(w, 1 / sc), height: Math.max(h, 1 / sc) };
        g.append(make('rect', { ...a, class: 'ppbz-under ppbz-thick' }), make('rect', { ...a, class: 'ppbz-box' }));
        if (w * sc >= 14 && h * sc >= 14) {
          const hs = (touch ? 14 : 9) / sc;
          HANDLES.forEach(([, fx, fy]) => g.append(make('rect', { class: 'ppbz-grip', x: x + fx * w - hs / 2, y: y + fy * h - hs / 2, width: hs, height: hs })));
        }
      }
      const changed = !!box && box.join() !== first;
      info.textContent = box ? `x ${box[0]} · y ${box[1]} · w ${box[2]} · h ${box[3]} (pixels of the original image)`
        : o.empty || 'No box yet: drag across the picture to draw one.';
      save.textContent = typeof o.save === 'function' ? o.save(box, changed) : o.save || 'Save box';
      save.disabled = !(o.ready ? o.ready(box, changed) : changed) || tiny(box);
      toBoxBtn.disabled = !(box || o.focus);
      level.textContent = Math.round(sc * 100) + ' %';
    }
    z.onRender = draw;
    function setMode(m) {
      mode = m;
      d.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      z.el.classList.toggle('ppbz-move', m === 'move' || space);
    }
    const toBox = () => { const b = box || o.focus; if (b) z.fit(box ? around(box, W, H) : b, true); };
    d.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !d.contains(b)) return;
      if (b.dataset.mode) setMode(b.dataset.mode);
      else if (b.dataset.z === 'in') z.zoomBy(STEP, true);
      else if (b.dataset.z === 'out') z.zoomBy(1 / STEP, true);
      else if (b.dataset.z === 'fit') z.fitAll(true);
      else if (b.dataset.z === 'box') toBox();
      else return;
      if (e.detail) view.focus({ preventScroll: true });  // clicked with the mouse: Space and the keys work on the picture again
    });
    d.addEventListener('keydown', e => {
      if (e.target.closest('a, input, select, textarea')) return;
      const onButton = !!e.target.closest('button');
      if (e.key === ' ' && !onButton) {  // held: the picture moves with the pointer
        e.preventDefault();
        if (!space) { space = true; z.el.classList.add('ppbz-move'); }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || (onButton && (e.key === 'Enter' || e.key === ' '))) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, f = e.shiftKey ? 0.5 : 0.15;
      if (k === '+' || k === '=') z.zoomBy(STEP, true);
      else if (k === '-' || k === '_') z.zoomBy(1 / STEP, true);
      else if (k === '0') z.fitAll(true);
      else if (k === 'b') toBox();
      else if (k === 'd') setMode('draw');
      else if (k === 'm') setMode('move');
      else if (k === 'ArrowLeft') z.panBy(view.clientWidth * f, 0);
      else if (k === 'ArrowRight') z.panBy(-view.clientWidth * f, 0);
      else if (k === 'ArrowUp') z.panBy(0, view.clientHeight * f);
      else if (k === 'ArrowDown') z.panBy(0, -view.clientHeight * f);
      else if (k === 'Enter') { if (!save.disabled) save.click(); }
      else return;
      e.preventDefault();
    });
    d.addEventListener('keyup', e => {
      if (e.key !== ' ' || !space) return;
      space = false;
      z.el.classList.toggle('ppbz-move', mode === 'move');
    });
    save.addEventListener('click', () => { const v = box && box.slice(); d.close(); if (o.onSave) o.onSave(v); });
    $('.ppbz-cancel').addEventListener('click', () => d.close());
    d.addEventListener('close', () => { z.destroy(); d.remove(); if (o.onClose) o.onClose(); });

    d.showModal();
    z.load({ iiif: o.iiif, img: o.img, size: o.size, shapes: o.shapes,
             start: o.focus || (box ? around(box, W, H) : [0, 0, W, H]) });
    draw();
    view.focus({ preventScroll: true });
    return { close: () => d.close() };
  }

  window.ppBoxZoom = { edit, view, around, prefetch: iiif => { new Image().src = baseUrl(iiif); } };
})();
