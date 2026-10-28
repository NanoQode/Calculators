'use strict';
const express = require('express');
const db = require('../db');
const leads = require('../lib/leads');
const otp = require('../lib/otp');
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

/** Where to send the visitor after a lead is saved: their results for a quote, otherwise the thank-you page. */
function afterLead(lead, submittedType) {
  const type = submittedType || lead.lead_type;
  return ['quote', 'calculator'].includes(type) && lead.product ? `/quote/results/${lead.ref}/` : `/thank-you/?ref=${lead.ref}`;
}
const leadFields = (body) => { const b = { ...body }; for (const k of ['_v', '_s', '_ref', '_landing', '_page', '_ts', 'utm', 'website', 'company_url']) delete b[k]; return b; };

router.post('/leads', leadLimiter, async (req, res, next) => {
  const body = parseBody(req);
  const wantsJson = req.is('application/json') || req.get('accept')?.includes('application/json');
  if (looksLikeBot(body)) return wantsJson ? res.json({ ok: true, ref: 'IS-0', redirect: '/' }) : res.redirect(303, '/');
  try {
    const ctx = ctxFrom(req, body);
    if (otp.active()) {
      // Hold the submission until the person confirms their mobile number with a texted code.
      leads.check(body);
      const v = await otp.start(leadFields(body), ctx, req.ip);
      if (wantsJson) return res.status(202).json({ ok: false, otp: true, ...v });
      return res.redirect(303, `/verify/${v.token}/`);
    }
    const lead = await leads.create(body, ctx);
    const redirect = afterLead(lead, body.lead_type);
    if (wantsJson) return res.json({ ok: true, ref: lead.ref, redirect, status: lead.status, repeat: lead.repeat });
    res.redirect(303, redirect);
  } catch (e) {
    if (e instanceof otp.OtpError) {
      if (wantsJson) return res.status(422).json({ ok: false, error: e.message, field: e.field });
      return res.redirect(303, `${(req.get('referer') || '/').replace(/\?.*$/, '')}?_err=${encodeURIComponent(e.message)}`);
    }
    if (e instanceof leads.LeadError) {
      if (wantsJson) return res.status(422).json({ ok: false, error: e.message, field: e.field });
      return res.redirect(303, `${(req.get('referer') || '/').replace(/\?.*$/, '')}?_err=${encodeURIComponent(e.message)}`);
    }
    next(e);
  }
});

// ───────────── SMS verification (JSON for the pop-up; the /verify/ page posts here too) ─────────────
const otpLimiter = tracking.rateLimit({ windowMs: 60_000, max: 20 });
function otpReply(req, res, fn) {
  const body = parseBody(req);
  const wantsJson = req.is('application/json') || req.get('accept')?.includes('application/json');
  const token = String(body.token || '');
  return fn(body, token).then((out) => {
    if (out && out.ref) { // a lead was created
      const redirect = afterLead(out, out.__type);
      return wantsJson ? res.json({ ok: true, ref: out.ref, redirect, repeat: out.repeat }) : res.redirect(303, redirect);
    }
    return wantsJson ? res.json({ ok: true, otp: true, ...out }) : res.redirect(303, `/verify/${token}/?_ok=${encodeURIComponent('We texted you a code.')}`);
  }).catch((e) => {
    if (!(e instanceof otp.OtpError) && !(e instanceof leads.LeadError)) throw e;
    if (wantsJson) return res.status(422).json({ ok: false, error: e.message, field: e.field, expired: !!e.expired, retry_in: e.retry_in });
    return res.redirect(303, e.expired ? '/' : `/verify/${token}/?_err=${encodeURIComponent(e.message)}`);
  });
}
router.post('/otp/send', otpLimiter, (req, res, next) => otpReply(req, res, (body, token) => otp.send(token, body.phone)).catch(next));
router.post('/otp/verify', otpLimiter, (req, res, next) => otpReply(req, res, async (body, token) => {
  const held = otp.get(token);
  const type = held ? (JSON.parse(held.payload || '{}').lead_type || 'quote') : 'quote';
  const lead = await otp.verify(token, body.code);
  return { ...lead, __type: type };
}).catch(next));

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
module.exports.afterLead = afterLead;
