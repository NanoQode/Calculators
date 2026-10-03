'use strict';
const express = require('express');
const db = require('../db');
const leads = require('../lib/leads');
const quoteEngine = require('../lib/quote-engine');
const tracking = require('../lib/tracking');
const pages = require('../lib/pages');
const { truncate } = require('../lib/util');

const router = express.Router();
router.use(express.text({ type: 'text/plain', limit: '16kb' }));

function ctxFrom(req, body) {
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  return {
    visitor_id: /^[A-Za-z0-9_-]{8,40}$/.test(body._v || '') ? body._v : null,
    session_id: /^[A-Za-z0-9_-]{8,40}$/.test(body._s || '') ? body._s : null,
    ip: req.ip, ua: req.get('user-agent'),
    referrer: truncate(body._ref || '', 300), landing_page: truncate(body._landing || '', 200), page_path: truncate(body._page || req.get('referer') || '', 200).replace(/^https?:\/\/[^/]+/, ''),
    utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, utm_term: utm.term, utm_content: utm.content,
  };
}

function looksLikeBot(body) {
  if (body.website || body.company_url) return true; // honeypot fields
  const ts = Number(body._ts);
  return Number.isFinite(ts) && ts > 0 && Date.now() - ts < 1500; // submitted faster than a human could
}

const leadLimiter = tracking.rateLimit({ windowMs: 60_000, max: 12 });

function parseBody(req) {
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  // Form posts send quote inputs as qi[field]=value
  if (body.qi && !body.quote_inputs) body.quote_inputs = body.qi;
  if (typeof body.quote_inputs === 'string') { try { body.quote_inputs = JSON.parse(body.quote_inputs); } catch { body.quote_inputs = {}; } }
  if (typeof body.utm === 'string') { try { body.utm = JSON.parse(body.utm); } catch { body.utm = {}; } }
  return body;
}

router.post('/leads', leadLimiter, async (req, res, next) => {
  const body = parseBody(req);
  const wantsJson = req.is('application/json') || req.get('accept')?.includes('application/json');
  if (looksLikeBot(body)) return wantsJson ? res.json({ ok: true, ref: 'IS-0', redirect: '/' }) : res.redirect(303, '/');
  try {
    if (body.lead_type === 'partial') body.lead_type = 'partial';
    const lead = await leads.create(body, ctxFrom(req, body));
    const redirect = ['quote', 'calculator'].includes(lead.lead_type) && lead.product ? `/quote/results/${lead.ref}/` : `/thank-you/?ref=${lead.ref}`;
    if (wantsJson) return res.json({ ok: true, ref: lead.ref, redirect, status: lead.status });
    res.redirect(303, redirect);
  } catch (e) {
    if (e instanceof leads.LeadError) {
      if (wantsJson) return res.status(422).json({ ok: false, error: e.message, field: e.field });
      return res.redirect(303, `${(req.get('referer') || '/').replace(/\?.*$/, '')}?_err=${encodeURIComponent(e.message)}`);
    }
    next(e);
  }
});

const estLimiter = tracking.rateLimit({ windowMs: 60_000, max: 120 });
router.post('/estimate', estLimiter, (req, res) => {
  const body = parseBody(req);
  const product = pages.getProduct(String(body.product || ''));
  if (!product) return res.status(400).json({ ok: false, error: 'Unknown product' });
  const inputs = body.quote_inputs && typeof body.quote_inputs === 'object' ? body.quote_inputs : {};
  const e = quoteEngine.estimate(product.slug, inputs);
  res.json({ ok: true, estimate: { low: e.low, mid: e.mid, high: e.high, periodLabel: e.periodLabel, headline: e.headline, example: e.example, asOf: e.asOf, notes: e.notes, tiers: e.tiers.map((t) => ({ name: t.name, label: t.label, monthly: t.monthly })) } });
});

const tLimiter = tracking.rateLimit({ windowMs: 60_000, max: 240 });
router.post('/t', tLimiter, (req, res) => {
  const body = parseBody(req);
  try { tracking.ingest(body, req); } catch (e) { /* analytics must never error to the client */ }
  res.status(204).end();
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ ok: true, results: [] });
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = db.all(`SELECT p.slug, p.title, p.excerpt, c.name AS category FROM posts p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published' AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.focus_keyword LIKE ? OR p.body_md LIKE ?)
    ORDER BY (p.title LIKE ?) DESC, p.published_at DESC LIMIT 12`, [like, like, like, like, like]);
  const prods = pages.enabledProducts().filter((p) => (p.name + ' ' + p.keywords.join(' ')).toLowerCase().includes(q.toLowerCase())).slice(0, 4);
  res.json({ ok: true, results: [...prods.map((p) => ({ url: `/${p.slug}/`, title: p.name, excerpt: p.tagline, category: 'Product' })), ...rows.map((r) => ({ url: `/guides/${r.slug}/`, title: r.title, excerpt: r.excerpt, category: r.category }))] });
});

module.exports = router;
