/* Feedback button for the Provenance Pursuit pages – GLAMhack 2026, challenge 304.
 *
 * Opens GitHub's «new issue» page of ruedtim/glamhack26-box-viewer with the issue form
 * .github/ISSUE_TEMPLATE/feedback.yml, prefilled with where the feedback comes from (page, work, label, box).
 * Nothing is sent from the page: the visitor reads the issue on GitHub and submits it with their own account.
 * Issues are public, so the form asks not to write names or addresses of private owners.
 *
 * Include once per page, in <head>:  <script src="feedback.js"></script>   (label-search: ../feedback.js)
 * - A floating «Feedback» button appears on every page. While a modal <dialog> is open it moves into it, so it stays
 *   clickable.
 * - window.ppFeedbackContext = () => ({ ... }) lets a page describe what is open; the floating button asks it on click.
 * - ppFeedback.html(ctx, text) returns an <a> as HTML for one item (for pages that build HTML strings),
 *   ppFeedback.link(ctx, text) the same as an element, ppFeedback.url(ctx) only the address.
 *   ctx, all optional: where ('Label', 'Work', …), inv, title, key (the stable label key), iiif (IIIF image service),
 *   box ([x, y, w, h] in original pixels), kind (one of ppFeedback.KINDS), note (one line).
 * - window.ppFeedbackFloating = false before this script hides the floating button on a page.
 */
(() => {
  if (window.ppFeedback) return;
  const REPO = 'https://github.com/ruedtim/glamhack26-box-viewer';
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
  function pageContext() {
    try { return typeof window.ppFeedbackContext === 'function' ? window.ppFeedbackContext() || {} : {}; }
    catch { return {}; }
  }

  function url(ctx) {
    const c = Object.assign({}, ctx || {});
    const where = [page(), c.where].filter(Boolean).join(' · ');
    const box = Array.isArray(c.box) && c.box.length === 4 ? c.box.map(v => Math.round(v)) : null;
    const lines = [`Where: ${where}`, `Page: ${cut(location.href, 600)}`];
    if (c.inv) lines.push(`Work: Inv. ${cut(c.inv, 40)}` + (c.title ? ` · ${cut(c.title, 120)}` : ''));
    else if (c.title) lines.push(`About: ${cut(c.title, 160)}`);
    if (c.key) lines.push(`Label key: ${cut(c.key, 160)}`);
    if (box) lines.push(`Box: ${box.join(',')} (x, y, w, h in original pixels)` + (c.iiif ? ` · ${c.iiif}/${box.join(',')}/max/0/default.jpg` : ''));
    else if (c.iiif) lines.push(`Image: ${c.iiif}/full/max/0/default.jpg`);
    if (c.note) lines.push(`Note: ${cut(c.note, 300)}`);
    lines.push(`Browser: ${browser()}`);
    const q = new URLSearchParams({ template: 'feedback.yml',
      title: cut('[Feedback] ' + [where, c.inv && `Inv. ${c.inv}`].filter(Boolean).join(' · '), 120),
      context: lines.join('\n') });
    if (KINDS.includes(c.kind)) q.set('kind', c.kind);
    return `${REPO}/issues/new?${q}`;
  }
  const html = (ctx, text = 'Report a problem') =>
    `<a class="ppfb-link" href="${esc(url(ctx))}" target="_blank" rel="noopener" title="Opens a prefilled GitHub issue (public)">${esc(text)}</a>`;
  function link(ctx, text = 'Report a problem') {
    const a = document.createElement('a');
    a.className = 'ppfb-link';
    a.href = url(ctx);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Opens a prefilled GitHub issue (public)';
    a.textContent = text;
    return a;
  }
  window.ppFeedback = { url, html, link, KINDS };

  const css = `
.ppfb { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 6px;
  font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 9px 13px; border-radius: 999px;
  border: 1px solid rgba(0,0,0,.16); background: #fff; color: #1c1b19; box-shadow: 0 2px 10px rgba(0,0,0,.16);
  text-decoration: none; cursor: pointer; }
.ppfb:hover { background: #f3f1ec; }
.ppfb:focus-visible, .ppfb-link:focus-visible { outline: 2px solid #2166ac; outline-offset: 2px; }
.ppfb svg { width: 14px; height: 14px; flex: none; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ppfb { background: #2a2826; color: #ece9e3; border-color: rgba(255,255,255,.18); }
  :root:not([data-theme="light"]) .ppfb:hover { background: #34312e; } }
:root[data-theme="dark"] .ppfb { background: #2a2826; color: #ece9e3; border-color: rgba(255,255,255,.18); }
:root[data-theme="dark"] .ppfb:hover { background: #34312e; }
@media print { .ppfb { display: none; } }`;

  function floating() {
    if (window.ppFeedbackFloating === false || document.querySelector('.ppfb')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const a = document.createElement('a');
    a.className = 'ppfb';
    a.href = REPO + '/issues/new?template=feedback.yml';
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Feedback: opens a prefilled GitHub issue (public; you need a GitHub account)';
    a.setAttribute('aria-label', 'Feedback: opens a prefilled GitHub issue');
    a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v7a1.5 1.5 0 0 1-1.5 1.5H8.6l-3 2.7A.6.6 0 0 1 4.6 13.2V11h-1.1A1.5 1.5 0 0 1 2 9.5v-7Z"/></svg>Feedback';
    a.addEventListener('click', () => { a.href = url(pageContext()); });  // the context of the moment of the click
    document.body.appendChild(a);
    const home = () => {  // into the open modal dialog (the rest of the page is inert then), else the body; move only on change
      const target = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
      if (a.parentNode !== target) target.appendChild(a);
    };
    new MutationObserver(home).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    home();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', floating); else floating();
})();
