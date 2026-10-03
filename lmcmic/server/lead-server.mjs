// lmcmic.ca lead endpoint.
//
//   POST /api/lead     investor intake → stored, emailed to the deal desk,
//                      answered with the redirect to the secure application
//   GET  /api/health   transport status (no lead data)
//
// The record comes first: every enquiry is appended to leads.jsonl before any
// attempt to email it, so a relay outage loses nothing. Email delivery runs
// from an outbox and is retried until it succeeds or a day has passed.
//
// No dependencies — Node 18+ (global fetch). Configuration by environment:
//   PORT                 default 3310 (nginx proxies /api/ here)
//   LEAD_DATA_DIR        default /var/lib/lmcmic
//   LEAD_NOTIFY_TO       default deals@lendmaxcapital.ca
//   LEAD_REDIRECT_URL    default https://app.lendmaxcapital.ca/investor-start
//   LEAD_FROM            sender for API transports, e.g. "lmcmic.ca <leads@lmcmic.ca>"
//   RESEND_API_KEY | POSTMARK_TOKEN | SENDGRID_API_KEY   preferred transports
//   FORMSUBMIT_ENABLED   default "1": HTTPS relay through formsubmit.co, used
//                        when no API key is set. Needs a one-time "Activate
//                        form" click in the LEAD_NOTIFY_TO inbox.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 3310);
const DATA = process.env.LEAD_DATA_DIR || '/var/lib/lmcmic';
const NOTIFY_TO = process.env.LEAD_NOTIFY_TO || 'deals@lendmaxcapital.ca';
const REDIRECT = process.env.LEAD_REDIRECT_URL || 'https://app.lendmaxcapital.ca/investor-start';
const FROM = process.env.LEAD_FROM || 'lmcmic.ca investor enquiries <leads@lmcmic.ca>';
const SITE = process.env.LEAD_SITE_ORIGIN || 'https://lmcmic.ca';
const LEADS = path.join(DATA, 'leads.jsonl');
const OUTBOX = path.join(DATA, 'outbox.json');

fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

// Every field the form sends, in the order the email lists them.
const FIELDS = [
  ['full_name', 'Full legal name'], ['email', 'Email'], ['phone', 'Phone'], ['province', 'Province'],
  ['investor_type', 'Investor classification'], ['allocation', 'Planned allocation'],
  ['contact_method', 'Preferred contact method'], ['best_time', 'Best time to contact'],
  ['best_days', 'Best days'], ['timezone', 'Investor time zone'], ['message', 'Questions / message'],
  ['consent', 'Consent to contact & OM'],
  ['form_id', 'Form'], ['page_url', 'Submitted from'], ['page_title', 'Page title'],
  ['landing_page', 'First landing page'], ['referrer', 'Referrer'],
  ['utm_source', 'utm_source'], ['utm_medium', 'utm_medium'], ['utm_campaign', 'utm_campaign'],
  ['utm_term', 'utm_term'], ['utm_content', 'utm_content'], ['gclid', 'gclid'], ['fbclid', 'fbclid'],
  ['msclkid', 'msclkid'], ['started_at', 'Form opened at'],
];
const REQUIRED = ['full_name', 'email', 'phone', 'province', 'investor_type', 'allocation', 'best_time', 'consent'];
const MAXLEN = { message: 2000, page_url: 1000, landing_page: 1000, referrer: 1000 };

/* ------------------------------------------------------------ rate limiting */
const hits = new Map();
function allowed(ip, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => t > now - windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length <= max;
}
setInterval(() => { const cut = Date.now() - 15 * 60_000; for (const [k, v] of hits) { const kept = v.filter((t) => t > cut); kept.length ? hits.set(k, kept) : hits.delete(k); } }, 60_000).unref();

/* ------------------------------------------------------------ validation */
function clean(v, max = 300) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function validate(body) {
  const lead = {};
  for (const [k] of FIELDS) lead[k] = clean(body[k], MAXLEN[k] || 300);
  const missing = REQUIRED.filter((k) => !lead[k]);
  if (missing.length) return { error: `Please complete: ${missing.map((k) => FIELDS.find((f) => f[0] === k)[1]).join(', ')}.` };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return { error: 'Please enter a valid email address.' };
  if ((lead.phone.match(/\d/g) || []).length < 7) return { error: 'Please enter a valid phone number.' };
  if (lead.consent !== 'yes') return { error: 'Please confirm the consent statement.' };
  return { lead };
}

/* ------------------------------------------------------------ email */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function compose(rec) {
  const l = rec.lead;
  const subject = `New investor enquiry: ${l.full_name} · ${l.allocation} · ${l.province} · call ${l.best_time}`;
  const rows = [['Reference', rec.id], ['Received', `${rec.received_local} (Toronto)`], ...FIELDS.map(([k, label]) => [label, l[k] || '—']),
    ['IP address', rec.ip], ['Browser', rec.user_agent]];
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`), '',
    `The investor was sent on to ${REDIRECT} to complete the secure application.`].join('\n');
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#0b1c30"><h2 style="font:600 18px Georgia,serif;margin:0 0 8px">New investor enquiry — lmcmic.ca</h2>
<p style="margin:0 0 12px"><strong>${esc(l.full_name)}</strong> asked to be contacted by <strong>${esc(l.contact_method || 'phone')}</strong>, best time <strong>${esc(l.best_time)}</strong> (${esc(l.best_days || 'any weekday')}, ${esc(l.timezone || 'time zone not given')}).</p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #e2e8f0">${rows.map(([k, v]) => `<tr><th align="left" style="background:#eff4ff;border:1px solid #e2e8f0;white-space:nowrap">${esc(k)}</th><td style="border:1px solid #e2e8f0">${esc(v)}</td></tr>`).join('')}</table>
<p style="color:#44474c">The investor was redirected to ${esc(REDIRECT)} to complete the secure application.</p></div>`;
  return { subject, text, html, replyTo: l.email };
}

async function viaResend(m) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [NOTIFY_TO], reply_to: m.replyTo, subject: m.subject, text: m.text, html: m.html }) });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
  return 'resend';
}
async function viaPostmark(m) {
  const r = await fetch('https://api.postmarkapp.com/email', { method: 'POST', headers: { 'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ From: FROM, To: NOTIFY_TO, ReplyTo: m.replyTo, Subject: m.subject, TextBody: m.text, HtmlBody: m.html, MessageStream: 'outbound' }) });
  if (!r.ok) throw new Error(`postmark ${r.status} ${await r.text()}`);
  return 'postmark';
}
async function viaSendgrid(m) {
  const fromEmail = (FROM.match(/<([^>]+)>/) || [, FROM])[1];
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ personalizations: [{ to: [{ email: NOTIFY_TO }] }], from: { email: fromEmail, name: 'lmcmic.ca' }, reply_to: { email: m.replyTo },
      subject: m.subject, content: [{ type: 'text/plain', value: m.text }, { type: 'text/html', value: m.html }] }) });
  if (!r.ok) throw new Error(`sendgrid ${r.status} ${await r.text()}`);
  return 'sendgrid';
}
async function viaFormSubmit(m, rec) {
  // FormSubmit lays the fields out as its own table; keys become row labels.
  const payload = { _subject: m.subject, _template: 'table', _captcha: 'false', _replyto: m.replyTo, Reference: rec.id, Received: `${rec.received_local} (Toronto)` };
  for (const [k, label] of FIELDS) payload[label] = rec.lead[k] || '—';
  payload['IP address'] = rec.ip;
  payload.Browser = rec.user_agent;
  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(NOTIFY_TO)}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: SITE, Referer: `${SITE}/contact/` }, body: JSON.stringify(payload) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || String(body.success) !== 'true') throw new Error(`formsubmit ${r.status} ${body.message || ''}`.trim());
  return 'formsubmit';
}

function transport() {
  if (process.env.RESEND_API_KEY) return ['resend', viaResend];
  if (process.env.POSTMARK_TOKEN) return ['postmark', viaPostmark];
  if (process.env.SENDGRID_API_KEY) return ['sendgrid', viaSendgrid];
  if (process.env.FORMSUBMIT_ENABLED !== '0') return ['formsubmit', viaFormSubmit];
  return ['none', null];
}

/* ------------------------------------------------------------ outbox */
const readOutbox = () => { try { return JSON.parse(fs.readFileSync(OUTBOX, 'utf8')); } catch { return []; } };
const writeOutbox = (q) => { fs.writeFileSync(OUTBOX + '.tmp', JSON.stringify(q, null, 1), { mode: 0o600 }); fs.renameSync(OUTBOX + '.tmp', OUTBOX); };
let lastDelivery = null;

async function deliver(rec) {
  const [name, fn] = transport();
  if (!fn) throw new Error('no email transport configured');
  const used = await fn(compose(rec), rec);
  lastDelivery = { at: new Date().toISOString(), via: used, ok: true };
  return used;
}

async function flushOutbox() {
  const q = readOutbox();
  if (!q.length) return;
  const keep = [];
  for (const item of q) {
    try {
      await deliver(item.rec);
      log('delivered', item.rec.id, 'after', item.attempts, 'retries');
    } catch (e) {
      item.attempts += 1; item.last_error = String(e.message || e);
      lastDelivery = { at: new Date().toISOString(), ok: false, error: item.last_error };
      if (Date.now() - Date.parse(item.rec.received_at) < 24 * 3600_000) keep.push(item);
      else log('gave up emailing', item.rec.id, '— still in leads.jsonl');
    }
  }
  writeOutbox(keep);
}
setInterval(() => flushOutbox().catch((e) => log('outbox error', e.message)), 5 * 60_000).unref();

/* ------------------------------------------------------------ http */
const log = (...a) => console.log(new Date().toISOString(), ...a);

function send(res, status, obj, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 32_768) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, transport: transport()[0], notify: NOTIFY_TO.replace(/^(.).*(@.*)$/, '$1***$2'), queued: readOutbox().length, lastDelivery });
  }
  if (url.pathname !== '/api/lead') return send(res, 404, { ok: false, error: 'Not found' });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });

  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  const wantsJson = String(req.headers.accept || '').includes('application/json');
  if (!allowed(ip)) return send(res, 429, { ok: false, error: 'Too many submissions from this connection. Please call us instead.' });

  let body = {};
  try {
    const raw = await readBody(req);
    body = String(req.headers['content-type'] || '').includes('application/json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
  } catch (e) {
    return send(res, e.status || 400, { ok: false, error: 'The form could not be read. Please try again.' });
  }

  // Bots: the honeypot is filled, or the form was submitted implausibly fast.
  const started = Date.parse(body.started_at || '');
  if (clean(body.company_website) || (started && Date.now() - started < 2500)) {
    log('dropped probable bot', ip);
    return wantsJson ? send(res, 200, { ok: true, redirect: REDIRECT }) : (res.writeHead(303, { Location: REDIRECT }), res.end());
  }

  const { lead, error } = validate(body);
  if (error) return wantsJson ? send(res, 422, { ok: false, error }) : (res.writeHead(303, { Location: `${SITE}/contact/?error=1#intake` }), res.end());

  const now = new Date();
  const rec = {
    id: `LMC-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    received_at: now.toISOString(),
    received_local: now.toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' }),
    ip, user_agent: clean(req.headers['user-agent'], 400), lead,
  };
  fs.appendFileSync(LEADS, JSON.stringify(rec) + '\n', { mode: 0o600 });
  log('lead', rec.id, lead.province, lead.allocation, lead.form_id);

  // Email in the background so the investor is never kept waiting on a relay.
  deliver(rec).then((via) => log('emailed', rec.id, 'via', via)).catch((e) => {
    log('email failed, queued', rec.id, e.message);
    lastDelivery = { at: new Date().toISOString(), ok: false, error: String(e.message) };
    const q = readOutbox(); q.push({ rec, attempts: 0, last_error: String(e.message) }); writeOutbox(q);
  });

  if (wantsJson) return send(res, 200, { ok: true, id: rec.id, redirect: REDIRECT });
  res.writeHead(303, { Location: REDIRECT, 'Cache-Control': 'no-store' });
  res.end();
});

server.listen(PORT, '127.0.0.1', () => log(`lmcmic lead endpoint on 127.0.0.1:${PORT}, transport=${transport()[0]}, notify=${NOTIFY_TO}`));
