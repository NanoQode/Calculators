'use strict';
/**
 * Agent billing in the back office.
 *   Agents (pay-per-lead):  /admin/plan (plan, credits, invoices), /admin/plan/checkout/:plan, /admin/plan/invoices/:id,
 *                           /admin/preferences (lead filters), POST /admin/leads/:id/claim (bad lead).
 *   Admins:                 /admin/billing (overview), invoices, plans, bad-lead claims, settings, per-agent billing.
 */
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const settings = require('../../lib/settings');
const billing = require('../../lib/billing');
const stripe = require('../../lib/stripe');
const config = require('../../config');
const geo = require('../../data/geo');
const { CATEGORIES, products } = require('../../data/products');
const { arr, sqlNow } = require('../../lib/util');

const router = express.Router();
const { BillingError } = billing;
const go = (res, url, msg, err) => res.redirect(303, `${url}${url.includes('?') ? '&' : '?'}${err ? '_err' : '_ok'}=${encodeURIComponent(msg)}`);
const origin = (req) => (config.isProd ? config.siteUrl : `${req.protocol}://${req.get('host')}`);
const common = () => ({ cad: billing.cad, cadShort: billing.cadShort, taxFor: billing.taxFor, provinces: geo.provinces, METHODS: billing.METHODS, stripeOn: stripe.configured(), isProd: config.isProd });

/** The signed-in agent's advisor row, when they pay per lead. */
function agentOnly(req, res, next) {
  const a = req.user.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [req.user.advisor_id]) : null;
  if (!a) return res.redirect('/admin/');
  if (!billing.isMetered(a)) return go(res, '/admin/me', 'Your account isn’t billed per lead, so there’s no plan to manage.', true);
  req.advisor = a;
  next();
}
function fail(res, url, e, next) {
  if (e instanceof BillingError || e.status === 502) return go(res, url, e.message, true);
  return next(e);
}

// ───────────────────────── Agent: plan & billing ─────────────────────────
router.get('/plan', agentOnly, (req, res) => {
  res.admin('plan', { title: 'Plan & billing', a: req.advisor, b: billing.summary(req.advisor.id), plans: billing.plans(), features: billing.includedFeatures(), bill: billing.profile(req.advisor.id), methods: billing.paymentMethods(), ...common() });
});

router.get('/plan/checkout/:plan', agentOnly, (req, res, next) => {
  const p = billing.plan(String(req.params.plan));
  if (!p || !p.active) return next();
  const sum = billing.summary(req.advisor.id);
  if (sum.active) return go(res, '/admin/plan', 'You already have a plan. Use “Switch” to change it from your next renewal.', true);
  if ((req.advisor.status || 'approved') !== 'approved') return go(res, '/admin/plan', 'Your account must be approved before you can choose a plan.', true);
  res.admin('checkout', { title: `Checkout: ${p.name}`, a: req.advisor, p, bill: billing.profile(req.advisor.id), methods: billing.paymentMethods(), rates: settings.get('tax_rates') || {}, features: billing.includedFeatures(), error: null, field: null, s: settings.all(), ...common() });
});
router.post('/plan/checkout/:plan', agentOnly, async (req, res, next) => {
  const p = billing.plan(String(req.params.plan));
  if (!p || !p.active) return next();
  try {
    const out = await billing.startCheckout(req.advisor.id, p.slug, { method: req.body.method, billing: req.body, origin: origin(req) });
    res.locals.audit('checkout', 'invoice', out.invoice.id, { plan: p.slug, method: req.body.method });
    if (out.redirect) return res.redirect(303, out.redirect);
    go(res, `/admin/plan/invoices/${out.invoice.id}`, 'Invoice created. Your plan starts as soon as the payment is confirmed.');
  } catch (e) {
    if (!(e instanceof BillingError) && e.status !== 502) return next(e);
    res.status(422);
    res.admin('checkout', { title: `Checkout: ${p.name}`, a: req.advisor, p, bill: { ...billing.profile(req.advisor.id), ...req.body }, methods: billing.paymentMethods(), rates: settings.get('tax_rates') || {}, features: billing.includedFeatures(), error: e.message, field: e.field, s: settings.all(), ...common() });
  }
});

/** Stripe success page: confirm the session straight away (the webhook may arrive later). */
router.get('/plan/return', agentOnly, async (req, res, next) => {
  try {
    const out = req.query.session_id && stripe.configured() ? await billing.confirmSession(String(req.query.session_id)) : null;
    if (out && out.invoice && out.invoice.advisor_id === req.advisor.id && !out.pending) return go(res, '/admin/plan', `Payment received — ${out.invoice.leads} lead credits were added. Welcome aboard!`);
    go(res, '/admin/plan', 'Thanks! Your payment is being confirmed; your credits appear here within a minute.');
  } catch (e) { fail(res, '/admin/plan', e, next); }
});

router.get('/plan/invoices/:id', (req, res, next) => {
  const inv = billing.invoice(Number(req.params.id));
  const admin = auth.hasPerm(req.user, 'billing');
  if (!inv || (!admin && inv.advisor_id !== req.user.advisor_id)) return next();
  res.admin('invoice', { title: `Invoice ${inv.number}`, inv, admin, a: db.get('SELECT * FROM advisors WHERE id = ?', [inv.advisor_id]), payments: db.all('SELECT * FROM payments WHERE invoice_id = ? ORDER BY id', [inv.id]), s: settings.all(), plan: billing.plan(inv.plan_id), ...common() });
});
router.post('/plan/invoices/:id/pay', agentOnly, async (req, res, next) => {
  const inv = billing.invoice(Number(req.params.id));
  if (!inv || inv.advisor_id !== req.advisor.id) return next();
  try {
    if (req.body.method === 'test' && !config.isProd && !stripe.configured()) {
      billing.markPaid(inv.id, { method: 'test', note: 'Test payment (development only)', userId: req.user.id });
      return go(res, '/admin/plan', `Test payment recorded — ${inv.leads} lead credits added.`);
    }
    if (!stripe.configured()) return go(res, `/admin/plan/invoices/${inv.id}`, 'Card payments aren’t switched on yet. Please pay by e-Transfer.', true);
    res.redirect(303, await billing.payInvoiceByCard(inv.id, origin(req)));
  } catch (e) { fail(res, `/admin/plan/invoices/${inv.id}`, e, next); }
});

router.post('/plan/profile', agentOnly, (req, res, next) => {
  try { billing.saveProfile(req.advisor.id, req.body); go(res, '/admin/plan#billing-details', 'Billing details saved'); } catch (e) { fail(res, '/admin/plan#billing-details', e, next); }
});
router.post('/plan/change', agentOnly, async (req, res, next) => {
  try { const p = await billing.changePlan(req.advisor.id, String(req.body.plan || ''), { userId: req.user.id }); go(res, '/admin/plan', `Your plan switches to ${p.name} at your next renewal.`); } catch (e) { fail(res, '/admin/plan', e, next); }
});
router.post('/plan/renewal', agentOnly, async (req, res, next) => {
  const on = req.body.renew === '1';
  try { await billing.setRenewal(req.advisor.id, on, { userId: req.user.id }); go(res, '/admin/plan', on ? 'Renewal is back on.' : 'Renewal turned off. Your plan runs to the end of this period, and unused credits stay on your balance.'); } catch (e) { fail(res, '/admin/plan', e, next); }
});

// ───────────────────────── Agent: lead preferences ─────────────────────────
router.get('/preferences', agentOnly, (req, res) => {
  const a = req.advisor;
  res.admin('preferences', { title: 'Lead preferences', a, pr: billing.prefs(a), licensed: db.json(a.provinces, []), lines: db.json(a.categories, []), provinces: geo.provinces, CATEGORIES, products, GRADES: billing.GRADES, otpOn: require('../../lib/otp').active() });
});
router.post('/preferences', agentOnly, (req, res) => {
  const a = req.advisor;
  const licensed = db.json(a.provinces, []), lines = db.json(a.categories, []);
  const b = req.body;
  const pr = {
    provinces: arr(b.provinces).filter((c) => licensed.includes(c)),
    categories: arr(b.categories).filter((c) => lines.includes(c)),
    products: arr(b.products).filter((p) => products.some((x) => x.slug === p && lines.includes(x.category))),
    min_grade: billing.GRADES.includes(b.min_grade) ? b.min_grade : '',
    verified_only: b.verified_only === 'on',
  };
  // Picking every option is the same as no filter.
  if (pr.provinces.length === licensed.length) pr.provinces = [];
  if (pr.categories.length === lines.length) pr.categories = [];
  db.update('advisors', a.id, { lead_prefs: pr, accepting_leads: b.accepting_leads ? 1 : 0, updated_at: sqlNow() });
  res.locals.audit('update', 'lead_prefs', a.id, pr);
  go(res, '/admin/preferences', 'Lead preferences saved');
});

// ───────────────────────── Agent: report a bad lead ─────────────────────────
router.post('/leads/:id/claim', (req, res, next) => {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [Number(req.params.id)]);
  if (!lead || !req.user.advisor_id || lead.advisor_id !== req.user.advisor_id) return next();
  try {
    billing.fileClaim(lead, req.user.advisor_id, { reason: req.body.reason, details: req.body.details, userId: req.user.id });
    go(res, `/admin/leads/${lead.id}`, 'Thanks — we’ll review this report and return the credit if the lead is invalid.');
  } catch (e) { fail(res, `/admin/leads/${lead.id}`, e, next); }
});

// ───────────────────────── Admin ─────────────────────────
const admin = auth.requirePerm('billing');

router.get('/billing', admin, (req, res) => {
  const status = ['active', 'past_due', 'pending', 'canceled'].includes(req.query.status) ? req.query.status : null;
  const subs = db.all(`SELECT s.*, a.name AS agent, a.email, p.name AS plan_name, (SELECT COALESCE(SUM(delta),0) FROM lead_credits c WHERE c.advisor_id = s.advisor_id) AS balance
    FROM subscriptions s JOIN advisors a ON a.id = s.advisor_id LEFT JOIN plans p ON p.id = s.plan_id
    WHERE ${status ? 's.status = ?' : "s.status IN ('active','past_due','pending')"} ORDER BY s.status, s.current_period_end`, status ? [status] : []);
  const freeAgents = db.all(`SELECT a.id, a.name, a.email, a.status, (SELECT COALESCE(SUM(delta),0) FROM lead_credits c WHERE c.advisor_id = a.id) AS balance,
      (SELECT COUNT(*) FROM lead_credits c WHERE c.advisor_id = a.id AND c.kind = 'lead' AND c.reversed_at IS NULL) AS delivered
    FROM advisors a WHERE a.billing = 'metered' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.advisor_id = a.id AND s.status IN ('active','past_due')) ORDER BY a.status = 'approved' DESC, a.name LIMIT 200`);
  res.admin('billing', {
    title: 'Billing', o: billing.overview(), subs, freeAgents, status,
    payments: db.all('SELECT p.*, i.number, a.name AS agent FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN advisors a ON a.id = p.advisor_id ORDER BY p.id DESC LIMIT 10'),
    ...common(),
  });
});

router.get('/billing/invoices', admin, (req, res) => {
  const status = ['open', 'paid', 'void', 'refunded'].includes(req.query.status) ? req.query.status : null;
  const q = String(req.query.q || '').trim();
  const where = []; const params = [];
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (q) { where.push('(i.number LIKE ? OR a.name LIKE ? OR a.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = db.all(`SELECT i.*, a.name AS agent FROM invoices i JOIN advisors a ON a.id = i.advisor_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.id DESC LIMIT 300`, params);
  const totals = db.all('SELECT status, COUNT(*) n, COALESCE(SUM(total_cents),0) total FROM invoices GROUP BY status');
  res.admin('billing-invoices', { title: 'Invoices', rows, status, q, totals: Object.fromEntries(totals.map((t) => [t.status, t])), ...common() });
});
router.get('/billing/invoices.csv', admin, (req, res) => {
  const { csvCell } = require('../../lib/util');
  const rows = db.all('SELECT i.*, a.name AS agent FROM invoices i JOIN advisors a ON a.id = i.advisor_id ORDER BY i.id');
  const head = ['number', 'issued', 'agent', 'status', 'subtotal', 'tax_label', 'tax_rate', 'tax', 'total', 'paid_at', 'period_start', 'period_end', 'tax_province'];
  const out = [head.join(',')].concat(rows.map((r) => [r.number, r.issued_at, r.agent, r.status, (r.subtotal_cents / 100).toFixed(2), r.tax_label, r.tax_rate, (r.tax_cents / 100).toFixed(2), (r.total_cents / 100).toFixed(2), r.paid_at, r.period_start, r.period_end, r.tax_province].map(csvCell).join(',')));
  res.set('Content-Disposition', 'attachment; filename="instasure-invoices.csv"').type('text/csv').send(out.join('\n'));
});
router.post('/billing/invoices/:id/paid', admin, (req, res, next) => {
  const id = Number(req.params.id);
  try {
    const method = billing.METHODS[req.body.method] && req.body.method !== 'test' ? req.body.method : 'etransfer';
    const out = billing.markPaid(id, { method, ref: String(req.body.ref || '').slice(0, 80) || null, note: String(req.body.note || '').slice(0, 300) || null, userId: req.user.id });
    go(res, `/admin/plan/invoices/${id}`, out.already ? 'Already paid' : `Marked paid — ${out.invoice.leads} lead credits added and the plan is active.`);
  } catch (e) { fail(res, `/admin/plan/invoices/${id}`, e, next); }
});
router.post('/billing/invoices/:id/void', admin, (req, res, next) => {
  const id = Number(req.params.id);
  try { billing.voidInvoice(id, { userId: req.user.id, note: req.body.note }); go(res, `/admin/plan/invoices/${id}`, 'Invoice voided'); } catch (e) { fail(res, `/admin/plan/invoices/${id}`, e, next); }
});
router.post('/billing/invoices/:id/refund', admin, (req, res, next) => {
  const id = Number(req.params.id);
  try { const r = billing.refundInvoice(id, { userId: req.user.id, note: req.body.note, removeCredits: req.body.remove_credits === 'on' }); go(res, `/admin/plan/invoices/${id}`, `Refund recorded${r.removed ? ` · ${r.removed} unused credits removed` : ''}. Return the money in Stripe or by e-Transfer.`); } catch (e) { fail(res, `/admin/plan/invoices/${id}`, e, next); }
});

router.get('/billing/plans', admin, (req, res) => res.admin('billing-plans', { title: 'Lead plans', rows: billing.plans({ all: true }), subsByPlan: Object.fromEntries(db.all("SELECT plan_id, COUNT(*) n FROM subscriptions WHERE status IN ('active','past_due') GROUP BY plan_id").map((r) => [r.plan_id, r.n])), features: billing.includedFeatures(), ...common() }));
router.post('/billing/plans', admin, (req, res) => {
  const b = req.body;
  const dollars = Number(String(b.price_per_lead || '').replace(/[$,\s]/g, ''));
  const row = {
    name: String(b.name || '').trim().slice(0, 40), tagline: String(b.tagline || '').trim().slice(0, 120) || null,
    leads_per_month: Math.round(Number(b.leads_per_month) || 0), price_per_lead_cents: Math.round(dollars * 100),
    badge: String(b.badge || '').trim().slice(0, 30) || null, sort: Math.round(Number(b.sort) || 0), active: b.active ? 1 : 0,
    features: String(b.features || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8), updated_at: sqlNow(),
  };
  if (!row.name || row.leads_per_month < 1 || row.price_per_lead_cents < 100) return go(res, '/admin/billing/plans', 'Each plan needs a name, at least 1 lead and a price of at least $1 per lead.', true);
  const id = Number(b.id) || null;
  if (id) {
    const before = db.get('SELECT * FROM plans WHERE id = ?', [id]);
    // A new price needs a new Stripe price; the product stays.
    db.update('plans', id, row);
    res.locals.audit('update', 'plan', id, { from: { leads: before.leads_per_month, ppl: before.price_per_lead_cents }, to: { leads: row.leads_per_month, ppl: row.price_per_lead_cents } });
  } else {
    let slug = require('../../lib/util').slugify(row.name) || 'plan'; let i = 1;
    while (db.get('SELECT 1 FROM plans WHERE slug = ?', [slug])) slug = `${require('../../lib/util').slugify(row.name)}-${++i}`;
    const nid = db.insert('plans', { ...row, slug });
    res.locals.audit('create', 'plan', nid, { slug });
  }
  go(res, '/admin/billing/plans', 'Plan saved. Existing subscribers keep their price until they change plan.');
});

const claimsPerm = auth.requirePerm('billing.claims');
router.get('/billing/claims', claimsPerm, (req, res) => {
  const tab = ['open', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'open';
  const rows = db.all(`SELECT c.*, l.ref, l.first_name, l.last_name, l.email, l.phone, l.product, l.province, l.status AS lead_status, l.assigned_at, a.name AS agent, u.name AS decided_name
    FROM lead_claims c JOIN leads l ON l.id = c.lead_id JOIN advisors a ON a.id = c.advisor_id LEFT JOIN users u ON u.id = c.decided_by WHERE c.status = ? ORDER BY c.id DESC LIMIT 200`, [tab]);
  const counts = Object.fromEntries(db.all('SELECT status, COUNT(*) n FROM lead_claims GROUP BY status').map((r) => [r.status, r.n]));
  res.admin('billing-claims', { title: 'Bad-lead reports', rows, tab, counts, REASONS: billing.CLAIM_REASONS });
});
router.post('/billing/claims/:id', claimsPerm, (req, res, next) => {
  try {
    const approve = req.body.decision === 'approve';
    billing.decideClaim(Number(req.params.id), { approve, note: req.body.note, userId: req.user.id, markJunk: req.body.mark_junk === 'on' });
    go(res, '/admin/billing/claims', approve ? 'Credit returned to the agent' : 'Report declined');
  } catch (e) { fail(res, '/admin/billing/claims', e, next); }
});

router.get('/billing/settings', admin, (req, res) => res.admin('billing-settings', {
  title: 'Billing settings', st: settings.all(), webhookUrl: `${config.siteUrl}/api/billing/stripe/webhook`,
  keys: { secret: { source: stripe.source('secret'), masked: stripe.mask(stripe.secretKey()) }, webhook: { source: stripe.source('webhook'), masked: stripe.mask(stripe.webhookSecret()) }, test: stripe.testMode() },
  ...common(),
}));
router.post('/billing/settings', admin, (req, res) => {
  const b = req.body;
  const rates = { ...(settings.get('tax_rates') || {}) };
  for (const p of geo.provinces) {
    if (b[`rate_${p.code}`] === undefined) continue; // a province missing from the form keeps its rate
    const rate = Number(String(b[`rate_${p.code}`] ?? '').replace(',', '.'));
    rates[p.code] = { label: String(b[`label_${p.code}`] || 'GST').trim().slice(0, 12) || 'GST', rate: Number.isFinite(rate) && rate >= 0 && rate < 30 ? Math.round(rate * 1000) / 1000 : 0 };
  }
  const int = (v, d, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const patch = {
    billing_enabled: b.billing_enabled === 'on', public_pricing: b.public_pricing === 'on',
    free_leads: int(b.free_leads, 10, 0, 1000), bad_lead_window_days: int(b.bad_lead_window_days, 7, 0, 90),
    invoice_prefix: String(b.invoice_prefix || 'INV-').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'INV-',
    invoice_terms_days: int(b.invoice_terms_days, 7, 0, 60), renewal_notice_days: int(b.renewal_notice_days, 7, 0, 30),
    gst_number: String(b.gst_number || '').trim().slice(0, 30),
    etransfer_email: require('../../lib/util').isEmail(b.etransfer_email) ? String(b.etransfer_email).trim().toLowerCase() : '',
    payment_instructions: String(b.payment_instructions || '').trim().slice(0, 600), tax_rates: rates,
  };
  // Stripe keys are write-only: a blank field keeps the saved key.
  const sk = String(b.stripe_secret_key || '').trim(), wh = String(b.stripe_webhook_secret || '').trim();
  if (sk && !/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(sk)) return go(res, '/admin/billing/settings', 'That doesn’t look like a Stripe secret key (it starts with sk_test_ or sk_live_). Nothing was saved.', true);
  if (wh && !/^whsec_[A-Za-z0-9]{10,}$/.test(wh)) return go(res, '/admin/billing/settings', 'That doesn’t look like a webhook signing secret (it starts with whsec_). Nothing was saved.', true);
  settings.setMany(patch);
  if (sk) settings.set('stripe_secret_key', sk);
  if (wh) settings.set('stripe_webhook_secret', wh);
  if (b.clear_stripe === 'on') { settings.set('stripe_secret_key', ''); settings.set('stripe_webhook_secret', ''); }
  require('../../lib/cache').clear();
  res.locals.audit('update', 'billing_settings', '', { ...patch, tax_rates: undefined, stripe_key_changed: !!sk || b.clear_stripe === 'on' || undefined, webhook_secret_changed: !!wh || undefined });
  go(res, '/admin/billing/settings', 'Billing settings saved');
});

router.get('/billing/agents/:id', admin, (req, res, next) => {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return next();
  res.admin('billing-agent', { title: `Billing: ${a.name}`, a, b: billing.summary(a.id), plans: billing.plans(), bill: billing.profile(a.id), ...common() });
});
router.post('/billing/agents/:id', admin, (req, res, next) => {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return next();
  const url = `/admin/billing/agents/${a.id}`;
  const b = req.body;
  try {
    if (b.action === 'mode') {
      const mode = b.billing === 'metered' ? 'metered' : 'exempt';
      db.update('advisors', a.id, { billing: mode, updated_at: sqlNow() });
      if (mode === 'metered' && (a.status || 'approved') === 'approved') billing.grantFree(a.id, { userId: req.user.id });
      res.locals.audit('billing_mode', 'advisor', a.id, { mode });
      return go(res, url, mode === 'metered' ? 'This agent now pays per lead.' : 'This agent is no longer billed (in-house).');
    }
    if (b.action === 'adjust') {
      billing.adjust(a.id, b.delta, b.note, req.user.id);
      res.locals.audit('credits', 'advisor', a.id, { delta: Number(b.delta), note: b.note });
      return go(res, url, 'Credits adjusted');
    }
    if (b.action === 'invoice') {
      // Issue an invoice by hand (e.g. an agent who pays by e-Transfer), optionally marked paid at once.
      const p = billing.plan(String(b.plan || ''));
      if (!p) throw new BillingError('Choose a plan.');
      if (!db.get('SELECT 1 FROM billing_profiles WHERE advisor_id = ?', [a.id])) billing.saveProfile(a.id, { name: a.name, email: a.email, address: b.address, city: b.city, province: b.province || db.json(a.provinces, [])[0], postal_code: b.postal_code });
      const cur = billing.current(a.id);
      if (cur && cur.status !== 'pending') throw new BillingError('This agent already has a plan. Use their renewal invoice, or change the plan.');
      const sub = cur || db.get('SELECT * FROM subscriptions WHERE id = ?', [db.insert('subscriptions', { advisor_id: a.id, plan_id: p.id, status: 'pending', leads_per_month: p.leads_per_month, price_per_lead_cents: p.price_per_lead_cents, provider: 'manual' })]);
      const inv = billing.createInvoice({ advisorId: a.id, plan: p, sub, kind: 'new', notes: String(b.note || '').slice(0, 300) || null });
      if (b.paid_method && billing.METHODS[b.paid_method]) billing.markPaid(inv.id, { method: b.paid_method, userId: req.user.id, note: 'Recorded by an admin' });
      else billing.notifyInvoice(inv, 'issued').catch(() => {});
      return go(res, `/admin/plan/invoices/${inv.id}`, 'Invoice created');
    }
    next();
  } catch (e) { fail(res, url, e, next); }
});

module.exports = router;
