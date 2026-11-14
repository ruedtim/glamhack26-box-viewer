/**
 * Provenance Pursuit – feedback relay (Google Apps Script web app), GLAMhack 2026, challenge 304.
 *
 * The «Feedback» form on the results site (feedback.js) posts here, and the relay keeps each message for a few hours.
 * The GitHub Action .github/workflows/feedback.yml in ruedtim/glamhack26-box-viewer fetches new messages every 10 minutes
 * and opens one issue each, with GitHub's own token. So no personal token is stored anywhere, and visitors need no
 * GitHub account.
 *
 * Endpoints: POST (from the page) stores a message; GET ?pending=1 lists the messages waiting (they become public issues
 * anyway); GET ?done=<id> removes one once its issue exists; GET alone says whether the relay runs.
 * Deploy: Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone.
 * Pause it without redeploying: script property ENABLED = no.
 *
 * Safeguards: length limits; a hidden field and a minimum time against bots; at most LIMIT_PER_HOUR and LIMIT_PER_DAY
 * messages in all (Apps Script does not see the sender's address); messages expire after KEEP_HOURS; the Action puts
 * visitor text into code blocks (no links, images or @mentions).
 */
const KINDS = ['A box is wrong or missing', 'A text or data value is wrong', "Something doesn't work", 'An idea or wish', 'Other'];
const LIMIT_PER_HOUR = 20;
const LIMIT_PER_DAY = 100;
const KEEP_HOURS = 6;
const MAX_BYTES = 8000;  // one script property holds at most 9 kB

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (paused(props)) return reply({ ok: false, error: 'Feedback through this form is paused; please open the issue on GitHub.' });
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website || !(Number(d.elapsed) >= 2000)) return reply({ ok: true });  // a bot (or no time given): say yes, keep nothing
    const item = {
      id: Utilities.getUuid().replace(/-/g, '').slice(0, 16), t: Date.now(),
      kind: KINDS.indexOf(d.kind) >= 0 ? d.kind : 'Other',
      where: clean(d.where, 80).replace(/[^\w\u00C0-\u024F\s·.,:()'\/-]/g, ''),  // \w alone is ASCII: keep ä, é …
      inv: clean(d.inv, 40).replace(/[^\w\u00C0-\u024F\s.\/-]/g, ''),
      details: clean(d.details, 4000), context: clean(d.context, 2000)
    };
    if (item.details.length < 5) return reply({ ok: false, error: 'Please describe the problem or idea.' });
    while (bytes(item) > MAX_BYTES && item.details.length > 200) item.details = item.details.slice(0, Math.floor(item.details.length * 0.8)) + '…';
    if (bytes(item) > MAX_BYTES) item.context = item.context.slice(0, 400) + '…';
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      if (!allow(props)) {
        return reply({ ok: false, error: 'There is a lot of feedback right now; please try again later or open the issue on GitHub.' });
      }
      props.setProperty('S:' + item.id, JSON.stringify(item));
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true, id: item.id });
  } catch (err) {
    return reply({ ok: false, error: 'The feedback could not be sent.' });
  }
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const p = (e && e.parameter) || {};
  if (p.done) {
    props.deleteProperty('S:' + String(p.done).replace(/[^0-9a-f]/gi, ''));
    return reply({ ok: true });
  }
  const items = waiting(props);
  if (p.pending) return reply({ ok: true, items: items });
  return reply({ ok: true, service: 'Provenance Pursuit feedback relay', waiting: items.length, enabled: !paused(props) });
}

function waiting(props) {  // messages without an issue yet, oldest first; expired ones are removed
  const all = props.getProperties(), now = Date.now(), out = [];
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S:') !== 0) return;
    let it = null;
    try { it = JSON.parse(all[k]); } catch (x) { it = null; }
    if (!it || now - it.t > KEEP_HOURS * 3600000) props.deleteProperty(k); else out.push(it);
  });
  return out.sort(function (a, b) { return a.t - b.t; });
}

function paused(props) {
  return String(props.getProperty('ENABLED') || 'yes').toLowerCase() === 'no';
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clean(s, n) {  // plain text without control characters, at most n characters
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function bytes(o) {
  return Utilities.newBlob(JSON.stringify(o)).getBytes().length;
}

function allow(props) {  // global limits per hour and per day (call inside the script lock)
  const now = Date.now();
  const log = JSON.parse(props.getProperty('LOG') || '[]').filter(function (t) { return now - t < 86400000; });
  const lastHour = log.filter(function (t) { return now - t < 3600000; }).length;
  if (lastHour >= LIMIT_PER_HOUR || log.length >= LIMIT_PER_DAY) return false;
  log.push(now);
  props.setProperty('LOG', JSON.stringify(log));
  return true;
}
