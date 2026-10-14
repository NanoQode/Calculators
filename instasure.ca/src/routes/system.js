'use strict';
const express = require('express');
const db = require('../db');
const settings = require('../lib/settings');
const crawlers = require('../lib/crawlers');
const mailer = require('../lib/mailer');
const leads = require('../lib/leads');
const scoring = require('../lib/scoring');
const seo = require('../lib/seo');
const { sqlNow } = require('../lib/util');

const router = express.Router();
const memo = new Map(); // short-lived memo for crawler docs (they are cheap but crawled often)
function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = fn();
  memo.set(key, { value, exp: Date.now() + ttlMs });
  return value;
}
router.clearMemo = () => memo.clear();
require('../lib/cache').onClear(() => memo.clear());

const text = (res, body, type = 'text/plain') => res.type(type).set('Cache-Control', 'public, max-age=900').send(body);

router.get('/robots.txt', (req, res) => text(res, crawlers.robots()));
router.get('/sitemap.xml', (req, res) => text(res, cached('sm', 60_000, crawlers.sitemapIndex), 'application/xml'));
router.get('/sitemap-:group.xml', (req, res, next) => {
  const xml = cached(`sm-${req.params.group}`, 60_000, () => crawlers.sitemap(req.params.group));
  if (!xml) return next();
  text(res, xml, 'application/xml');
});
router.get('/llms.txt', (req, res) => text(res, cached('llms', 60_000, crawlers.llmsTxt), 'text/markdown; charset=utf-8'));
router.get('/llms-full.txt', (req, res) => text(res, cached('llms-full', 60_000, crawlers.llmsFullTxt), 'text/markdown; charset=utf-8'));

// IndexNow key verification file: /{key}.txt
router.get(/^\/([a-f0-9]{32})\.txt$/, (req, res, next) => {
  const key = settings.get('indexnow_key');
  if (!key || req.params[0] !== key) return next();
  text(res, key);
});

// Markdown twin of each guide for LLM tooling (noindex to avoid duplicate content).
router.get('/guides/:slug.md', (req, res, next) => {
  const p = db.get("SELECT * FROM posts WHERE slug = ? AND status = 'published'", [req.params.slug]);
  if (!p) return next();
  const tk = db.json(p.takeaways, []);
  const body = [`# ${p.title}`, '', `Canonical: ${seo.abs(`/guides/${p.slug}/`)}`, `Last updated: ${String(p.updated_at).slice(0, 10)}`, '', ...(tk.length ? ['## Key takeaways', ...tk.map((t) => `- ${t}`), ''] : []), p.body_md].join('\n');
  res.set('X-Robots-Tag', 'noindex').type('text/markdown; charset=utf-8').send(body);
});

// ───────────── Email tracking ─────────────
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
router.get('/e/o/:token.gif', (req, res) => {
  const e = db.get('SELECT id, lead_id, open_count FROM emails WHERE token = ?', [req.params.token]);
  if (e) {
    db.run('UPDATE emails SET open_count = open_count + 1, opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP) WHERE id = ?', [e.id]);
    if (e.lead_id && !e.open_count) { db.insert('lead_events', { lead_id: e.lead_id, type: 'email_open', data: { email_id: e.id } }); scoring.rescore(e.lead_id, 'email opened'); }
  }
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, private' }).send(GIF);
});
router.get('/e/c/:token', (req, res) => {
  const url = String(req.query.u || '');
  if (!/^https?:\/\//.test(url) || !mailer.verifyClick(req.params.token, url, String(req.query.s || ''))) return res.redirect('/');
  const e = db.get('SELECT id, lead_id, click_count FROM emails WHERE token = ?', [req.params.token]);
  if (e) {
    db.run('UPDATE emails SET click_count = click_count + 1, clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP), open_count = MAX(open_count, 1), opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP) WHERE id = ?', [e.id]);
    if (e.lead_id) { db.insert('lead_events', { lead_id: e.lead_id, type: 'email_click', data: { email_id: e.id, url } }); scoring.rescore(e.lead_id, 'email clicked'); }
  }
  res.redirect(302, url);
});

// ───────────── CASL unsubscribe (GET = confirm page, POST = one-click) ─────────────
function findLead(req) {
  const ref = String(req.query.l || req.body.l || '');
  const sig = String(req.query.s || req.body.s || '');
  if (!ref || !mailer.verifyUnsubscribe(ref, sig)) return null;
  return db.get('SELECT * FROM leads WHERE ref = ?', [ref]);
}
router.get('/unsubscribe', (req, res) => {
  const lead = findLead(req);
  res.page('public/unsubscribe', {
    noCache: true, lead, done: false, l: req.query.l, sig: req.query.s,
    meta: seo.meta({ path: '/unsubscribe', title: 'Email preferences', description: 'Manage your email preferences.', robots: 'noindex,nofollow' }),
  });
});
router.post('/unsubscribe', (req, res) => {
  const lead = findLead(req);
  if (lead) leads.unsubscribe(lead, req.body['List-Unsubscribe'] ? 'one-click header' : 'unsubscribe page');
  if (req.body['List-Unsubscribe']) return res.status(200).send('Unsubscribed');
  res.page('public/unsubscribe', {
    noCache: true, lead, done: !!lead,
    meta: seo.meta({ path: '/unsubscribe', title: 'You’re unsubscribed', description: 'Email preferences updated.', robots: 'noindex,nofollow' }),
  });
});

router.get('/healthz', (req, res) => res.json({ ok: true, time: sqlNow(), db: !!db.value('SELECT 1') }));

module.exports = router;
