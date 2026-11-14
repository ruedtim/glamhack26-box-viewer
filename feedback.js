/* Feedback button for the Provenance Pursuit pages – GLAMhack 2026, challenge 304.
 *
 * Feedback becomes an issue in the public GitHub repository ruedtim/glamhack26-box-viewer, in one of two ways:
 * - Without a GitHub account: a small form on the page sends it to the feedback relay (feedback-relay/Code.gs, a Google
 *   Apps Script web app). The GitHub Action .github/workflows/feedback.yml fetches new messages every 10 minutes and
 *   opens the issues with GitHub's own token; no personal token is stored anywhere.
 * - With a GitHub account, or when no relay is set: GitHub's «new issue» page with the issue form
 *   .github/ISSUE_TEMPLATE/feedback.yml, prefilled.
 * Both carry where the feedback comes from (page, work, label key, box). Issues are public, so the form asks not to write
 * names or addresses of private owners.
 *
 * Include once per page, in <head>:  <script src="feedback.js"></script>   (label-search: ../feedback.js)
 * - A floating «Feedback» button appears on every page. While a modal <dialog> is open it moves into it, so it stays
 *   clickable.
 * - window.ppFeedbackContext = () => ({ ... }) lets a page describe what is open; the floating button asks it on click.
 * - ppFeedback.html(ctx, text) returns an <a> as HTML for one item (for pages that build HTML strings),
 *   ppFeedback.link(ctx, text) the same as an element, ppFeedback.url(ctx) the GitHub address.
 *   ctx, all optional: where ('Label', 'Work', …), inv, title, key (the stable label key), iiif (IIIF image service),
 *   box ([x, y, w, h] in original pixels), kind (one of ppFeedback.KINDS), note (one line).
 * - window.ppFeedbackFloating = false before this script hides the floating button on a page;
 *   window.ppFeedbackRelay = '' switches the relay off (straight to GitHub), or names another relay address.
 */
(() => {
  if (window.ppFeedback) return;
  const REPO = 'https://github.com/ruedtim/glamhack26-box-viewer';
  const SITE = 'https://ruedtim.github.io/glamhack26-box-viewer/';
  const ROOT = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');  // folder of feedback.js
  const RELAY_DEFAULT = 'https://script.google.com/macros/s/AKfycbwq5h4eYLosUKT5GRU-6PGGK5sowW_voGYxxn3DRq9g4Ngua-r4scgbuTz5NuladMGS5g/exec';  // web app address of feedback-relay/Code.gs (https://script.google.com/macros/s/…/exec)
  const RELAY = typeof window.ppFeedbackRelay === 'string' ? window.ppFeedbackRelay : RELAY_DEFAULT;
  const KINDS = ['A box is wrong or missing', 'A text or data value is wrong', "Something doesn't work",
                 'An idea or wish', 'Other'];
  const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function page() {
    const path = location.pathname;
    if (/\/label-search\//.test(path)) return 'Label search';
    return { 'form.html': 'Entry form', 'review.html': 'Review page', 'viewer.html': 'Box viewer',
             'sik_isea.html': 'What SIK-ISEA adds' }[path.split('/').pop()] || 'Results site';
  }
  function browser() {
    const ua = navigator.userAgent;
    const name = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari' : 'another browser';
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS'
      : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'another system';
    return `${name} on ${os}, window ${innerWidth} × ${innerHeight}`;
  }
  function address() {  // opened from disk, the address would show a local path (with the user name): use the online one
    if (location.protocol !== 'file:') return location.href;
    const rel = ROOT && location.href.startsWith(ROOT) ? location.href.slice(ROOT.length) : location.pathname.split('/').pop();
    return SITE + rel + ' (offline copy)';
  }
  function pageContext() {
    try { return typeof window.ppFeedbackContext === 'function' ? window.ppFeedbackContext() || {} : {}; }
    catch { return {}; }
  }

  // where the feedback comes from: «where», the issue title and the lines filled in for the reader of the issue
  function about(ctx) {
    const c = ctx || {}, p = page();
    const where = c.where && !p.toLowerCase().startsWith(String(c.where).toLowerCase()) ? `${p} · ${cut(c.where, 40)}` : p;
    const box = Array.isArray(c.box) && c.box.length === 4 && c.box.every(v => Number.isFinite(+v)) ? c.box.map(v => Math.round(v)) : null;
    const lines = [`Where: ${where}`, `Page: ${cut(address(), 600)}`];
    if (c.inv) lines.push(`Work: Inv. ${cut(c.inv, 40)}` + (c.title ? ` · ${cut(c.title, 120)}` : ''));
    else if (c.title) lines.push(`About: ${cut(c.title, 160)}`);
    if (c.key) lines.push(`Label key: ${cut(c.key, 160)}`);
    if (box) lines.push(`Box: ${box.join(',')} (x, y, w, h in original pixels)` + (c.iiif ? ` · ${c.iiif}/${box.join(',')}/max/0/default.jpg` : ''));
    else if (c.iiif) lines.push(`Image: ${c.iiif}/full/max/0/default.jpg`);
    if (c.note) lines.push(`Note: ${cut(c.note, 300)}`);
    lines.push(`Browser: ${browser()}`);
    const inv = c.inv ? cut(c.inv, 40) : '';
    return { where, inv, kind: KINDS.includes(c.kind) ? c.kind : '', lines,
             title: cut('[Feedback] ' + [where, inv && `Inv. ${inv}`].filter(Boolean).join(' · '), 120) };
  }
  function url(ctx) {
    const a = about(ctx);
    const q = new URLSearchParams({ template: 'feedback.yml', title: a.title, context: a.lines.join('\n') });
    if (a.kind) q.set('kind', a.kind);
    return `${REPO}/issues/new?${q}`;
  }
  const html = (ctx, text = 'Report a problem') =>
    `<a class="ppfb-link" href="${esc(url(ctx))}" data-ppfb="${esc(JSON.stringify(ctx || {}))}" target="_blank" rel="noopener" title="Send feedback (it becomes a public GitHub issue)">${esc(text)}</a>`;
  function link(ctx, text = 'Report a problem') {
    const a = document.createElement('a');
    a.className = 'ppfb-link';
    a.href = url(ctx);
    a.dataset.ppfb = JSON.stringify(ctx || {});
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Send feedback (it becomes a public GitHub issue)';
    a.textContent = text;
    return a;
  }
  window.ppFeedback = { url, html, link, KINDS, open: ctx => form(ctx || pageContext()) };

  const css = `
.ppfb { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 6px;
  font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 9px 13px; border-radius: 999px;
  border: 1px solid rgba(0,0,0,.16); background: #fff; color: #1c1b19; box-shadow: 0 2px 10px rgba(0,0,0,.16);
  text-decoration: none; cursor: pointer; }
.ppfb:hover { background: #f3f1ec; }
.ppfb:focus-visible, .ppfb-link:focus-visible, .ppfb-dialog :focus-visible { outline: 2px solid #2166ac; outline-offset: 2px; }
.ppfb svg { width: 14px; height: 14px; flex: none; }
.ppfb-dialog { width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); box-sizing: border-box; padding: 18px 18px 14px;
  border: 1px solid rgba(0,0,0,.16); border-radius: 12px; background: #fff; color: #1c1b19;
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 10px 40px rgba(0,0,0,.25); }
.ppfb-dialog::backdrop { background: rgba(0,0,0,.35); }
.ppfb-dialog h2 { margin: 0 0 6px; font-size: 18px; }
.ppfb-dialog p { margin: 0 0 12px; }
.ppfb-dialog .ppfb-note { font-size: 13px; color: #5d5951; }
.ppfb-dialog label { display: block; margin: 0 0 12px; font-weight: 600; font-size: 14px; }
.ppfb-dialog select, .ppfb-dialog textarea { display: block; width: 100%; box-sizing: border-box; margin-top: 4px; font: 14px/1.4 inherit;
  font-family: inherit; color: inherit; background: transparent; border: 1px solid rgba(0,0,0,.25); border-radius: 8px; padding: 7px 9px; }
.ppfb-dialog textarea[name=context] { font: 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #5d5951; }
.ppfb-dialog .ppfb-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.ppfb-dialog .ppfb-status { min-height: 1.4em; font-size: 14px; }
.ppfb-dialog .ppfb-status.bad { color: #b3261e; }
.ppfb-dialog .ppfb-status.good { color: #1a7f4b; }
.ppfb-dialog .ppfb-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: flex-end; }
.ppfb-dialog .ppfb-actions a { margin-right: auto; font-size: 13px; color: inherit; }
.ppfb-dialog button { font: 600 14px/1 inherit; font-family: inherit; padding: 9px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(0,0,0,.25); background: transparent; color: inherit; }
.ppfb-dialog button.ppfb-send { background: #1a7f4b; border-color: #1a7f4b; color: #fff; }
.ppfb-dialog button:disabled { opacity: .55; cursor: default; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .ppfb { background: #2a2826; color: #ece9e3; border-color: rgba(255,255,255,.18); }
  :root:not([data-theme="light"]) .ppfb:hover { background: #34312e; }
  :root:not([data-theme="light"]) .ppfb-dialog { background: #22201d; color: #ece9e3; border-color: rgba(255,255,255,.18); }
  :root:not([data-theme="light"]) .ppfb-dialog .ppfb-note, :root:not([data-theme="light"]) .ppfb-dialog textarea[name=context] { color: #a29d94; }
  :root:not([data-theme="light"]) .ppfb-dialog select, :root:not([data-theme="light"]) .ppfb-dialog textarea,
  :root:not([data-theme="light"]) .ppfb-dialog button { border-color: rgba(255,255,255,.25); }
  :root:not([data-theme="light"]) .ppfb-dialog select option { background: #22201d; }
  :root:not([data-theme="light"]) .ppfb-dialog .ppfb-status.bad { color: #ff8a7a; }
  :root:not([data-theme="light"]) .ppfb-dialog .ppfb-status.good { color: #52c891; } }
:root[data-theme="dark"] .ppfb { background: #2a2826; color: #ece9e3; border-color: rgba(255,255,255,.18); }
:root[data-theme="dark"] .ppfb:hover { background: #34312e; }
:root[data-theme="dark"] .ppfb-dialog { background: #22201d; color: #ece9e3; border-color: rgba(255,255,255,.18); }
:root[data-theme="dark"] .ppfb-dialog .ppfb-note, :root[data-theme="dark"] .ppfb-dialog textarea[name=context] { color: #a29d94; }
:root[data-theme="dark"] .ppfb-dialog select, :root[data-theme="dark"] .ppfb-dialog textarea,
:root[data-theme="dark"] .ppfb-dialog button { border-color: rgba(255,255,255,.25); }
:root[data-theme="dark"] .ppfb-dialog select option { background: #22201d; }
:root[data-theme="dark"] .ppfb-dialog .ppfb-status.bad { color: #ff8a7a; }
:root[data-theme="dark"] .ppfb-dialog .ppfb-status.good { color: #52c891; }
@media print { .ppfb { display: none; } }`;
  let styled = false;
  function style() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- the form (only with a relay)
  let dlg = null, opened = 0, current = null;
  function build() {
    style();
    dlg = document.createElement('dialog');
    dlg.className = 'ppfb-dialog';
    dlg.setAttribute('aria-labelledby', 'ppfb-h');
    dlg.innerHTML = `<form method="dialog">
  <h2 id="ppfb-h">Feedback</h2>
  <p class="ppfb-note">It becomes a <b>public</b> issue on GitHub within about 10 to 20 minutes; you need no GitHub account.
    Please don't write names or addresses of private owners, or your own contact details.</p>
  <label>What is it about?<select name="kind" required><option value="">Choose…</option>${KINDS.map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
  <label>What did you see, and what did you expect?<textarea name="details" rows="5" required minlength="5" maxlength="4000"
    placeholder="For example: the box covers the wrong label; the dealer's label is at the top right of the stretcher."></textarea></label>
  <label>Sent along (where you were; edit or delete)<textarea name="context" rows="4" maxlength="2000"></textarea></label>
  <input class="ppfb-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <p class="ppfb-status" role="status" aria-live="polite"></p>
  <div class="ppfb-actions">
    <a class="ppfb-gh" target="_blank" rel="noopener">Open on GitHub instead</a>
    <button type="submit" value="cancel" formnovalidate>Close</button>
    <button type="submit" value="send" class="ppfb-send">Send</button>
  </div>
</form>`;
    document.body.appendChild(dlg);
    dlg.querySelector('form').addEventListener('submit', send);
    dlg.querySelector('textarea[name=details]').addEventListener('input', () => {  // after a sent message: ready for the next
      dlg.querySelector('.ppfb-send').disabled = false;
    });
  }
  function form(ctx) {
    if (!RELAY) { window.open(url(ctx), '_blank', 'noopener'); return; }
    if (!dlg) build();
    current = about(ctx);
    const f = dlg.querySelector('form');
    f.kind.value = current.kind;
    f.context.value = current.lines.join('\n');
    dlg.querySelector('.ppfb-gh').href = url(ctx);
    status('', '');
    f.querySelector('.ppfb-send').disabled = false;
    opened = Date.now();
    dlg.showModal();
    (current.kind ? f.details : f.kind).focus();
  }
  function status(text, cls, href, linkText = 'Open it') {
    const s = dlg.querySelector('.ppfb-status');
    s.className = 'ppfb-status' + (cls ? ' ' + cls : '');
    s.textContent = text;
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = linkText;
      s.append(' ', a);
    }
  }
  async function send(ev) {
    if (ev.submitter && ev.submitter.value !== 'send') return;  // «Close»: the dialog closes by itself
    ev.preventDefault();
    const f = ev.target, button = f.querySelector('.ppfb-send');
    if (!f.reportValidity()) return;
    button.disabled = true;
    status('Sending…', '');
    try {
      const r = await fetch(RELAY, { method: 'POST', body: JSON.stringify({  // text/plain: no preflight request
        kind: f.kind.value, details: f.details.value, context: f.context.value, where: current.where, inv: current.inv,
        website: f.website.value, elapsed: Date.now() - opened }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'The feedback could not be sent.');
      f.details.value = '';
      if (typeof j.url === 'string' && j.url.startsWith(REPO + '/issues/')) status(`Thank you! Sent as issue #${j.number}.`, 'good', j.url);
      else status('Thank you! It becomes a public GitHub issue within about 10 to 20 minutes.', 'good',
                  `${REPO}/issues?q=${encodeURIComponent('label:"via form"')}`, 'See the feedback issues');
    } catch (e) {
      button.disabled = false;
      const msg = e && e.message && !/fetch|network|JSON/i.test(e.message) ? e.message : 'The feedback could not be sent.';
      status(/github/i.test(msg) ? msg : `${msg} You can also open it on GitHub (link on the left).`, 'bad');
    }
  }
  const plain = e => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  document.addEventListener('click', e => {  // inline «Report a problem» links: the form instead of GitHub, if a relay is set
    const a = e.target.closest && e.target.closest('a.ppfb-link[data-ppfb]');
    if (!a || !RELAY || !plain(e)) return;
    e.preventDefault();
    let ctx = {};
    try { ctx = JSON.parse(a.dataset.ppfb); } catch { /* the page's context then */ }
    form(ctx);
  });

  // ---------------------------------------------------------------- the floating button
  function floating() {
    if (window.ppFeedbackFloating === false || document.querySelector('.ppfb')) return;
    style();
    const a = document.createElement('a');
    a.className = 'ppfb';
    a.href = REPO + '/issues/new?template=feedback.yml';
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Feedback: it becomes a public GitHub issue';
    a.setAttribute('aria-label', 'Feedback');
    a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v7a1.5 1.5 0 0 1-1.5 1.5H8.6l-3 2.7A.6.6 0 0 1 4.6 13.2V11h-1.1A1.5 1.5 0 0 1 2 9.5v-7Z"/></svg>Feedback';
    a.addEventListener('click', e => {
      const ctx = pageContext();  // the context of the moment of the click
      a.href = url(ctx);
      if (RELAY && plain(e)) { e.preventDefault(); form(ctx); }
    });
    document.body.appendChild(a);
    const home = () => {  // into the open modal dialog (the rest of the page is inert then), else the body; move only on change
      const target = [...document.querySelectorAll('dialog[open]:not(.ppfb-dialog)')].pop() || document.body;
      if (a.parentNode !== target) target.appendChild(a);
    };
    new MutationObserver(home).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    home();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', floating); else floating();
})();
