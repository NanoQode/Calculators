'use strict';
/**
 * Agent billing: plans, lead credits, subscriptions, invoices, checkout and bad-lead claims.
 *
 * Model
 *   - Self-registered agents are 'metered' (advisors.billing). In-house agents are 'exempt' and never billed.
 *   - Approval grants a one-time pool of free lead credits (settings.free_leads, default 10).
 *   - A paid plan adds leads_per_month credits each paid period. Credits don't expire: if fewer leads are
 *     delivered in a month than the plan includes, the balance carries over.
 *   - Every lead delivered to a metered agent uses one credit (free credits first). A lead moved away
 *     from the agent, or accepted as a bad lead, gives the credit back. Routing only offers a lead to a
 *     metered agent with a positive balance (lib/routing.js).
 *   - Payment: Stripe Checkout (card, monthly auto-renewal) when STRIPE_SECRET_KEY is set; otherwise an
 *     invoice paid by Interac e-Transfer that an admin marks paid. Manual renewals are invoiced
 *     settings.renewal_notice_days before the period ends.
 */
const db = require('../db');
const settings = require('./settings');
const config = require('../config');
const stripe = require('./stripe');
const U = require('./util');
const geo = require('../data/geo');

class BillingError extends Error { constructor(m, field) { super(m); this.field = field; this.status = 422; } }

const DEFAULT_PLANS = [
  { slug: 'starter', name: 'Starter', leads_per_month: 10, price_per_lead_cents: 4000, tagline: 'Test the waters with 10 exclusive leads a month', sort: 1 },
  { slug: 'growth', name: 'Growth', leads_per_month: 50, price_per_lead_cents: 3500, tagline: 'A steady pipeline for a growing book', badge: 'Most popular', sort: 2 },
  { slug: 'scale', name: 'Scale', leads_per_month: 100, price_per_lead_cents: 3000, tagline: 'The lowest cost per lead, for teams', sort: 3 },
];
const CLAIM_REASONS = {
  wrong_contact: 'The phone number and email don’t work',
  fake: 'Fake, prank or test request',
  not_requested: 'The person says they never asked to be contacted',
  duplicate: 'Duplicate of a lead I already received',
  outside_licence: 'Outside the province or line I’m licensed for',
};
const METHODS = { card: 'Card (Stripe)', etransfer: 'Interac e-Transfer', cheque: 'Cheque', comp: 'Complimentary (no charge)', test: 'Test payment' };
const GRADES = ['A', 'B', 'C', 'D'];

/** $1,750.00 — invoices always show cents. */
const cad = (cents) => U.money((Number(cents) || 0) / 100, { cents: true });
/** $1,750 / $1,977.50 — marketing and cards drop ".00". */
const cadShort = (cents) => U.money((Number(cents) || 0) / 100, { cents: (Number(cents) || 0) % 100 !== 0 });

function addMonth(sql) {
  const d = U.toDate(sql);
  const day = d.getUTCDate();
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
  n.setUTCDate(Math.min(day, last));
  return n.toISOString().replace('T', ' ').slice(0, 19);
}
const toSql = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 19);

// ───────────────────────── Plans ─────────────────────────
function decorate(p) { return p ? { ...p, monthly_cents: p.leads_per_month * p.price_per_lead_cents, features: db.json(p.features, []) } : null; }
function plans({ all = false } = {}) { return db.all(`SELECT * FROM plans ${all ? '' : 'WHERE active = 1'} ORDER BY sort, leads_per_month`).map(decorate); }
function plan(idOrSlug) { return decorate(db.get(`SELECT * FROM plans WHERE ${typeof idOrSlug === 'number' ? 'id' : 'slug'} = ?`, [idOrSlug])); }
function seedPlans() {
  if (db.value('SELECT COUNT(*) FROM plans')) return 0;
  for (const p of DEFAULT_PLANS) db.insert('plans', { ...p, features: [] });
  return DEFAULT_PLANS.length;
}
/** What every plan (and the free start) includes. Phone verification is listed only while SMS codes are actually on. */
function includedFeatures() {
  const list = ['Exclusive: each lead goes to one agent only, never resold', 'Lead score and A–D grade on every lead', 'Province, product and lead-grade filters', 'Instant email alert for every new lead', 'Credit back for bad leads', 'Pipeline, follow-up reminders and conversion tracking'];
  if (require('./otp').active()) list.splice(1, 0, 'Phone numbers confirmed by SMS code');
  return list;
}

// ───────────────────────── Agents and billing details ─────────────────────────
const isMetered = (a) => !!a && a.billing === 'metered';
const advisorRow = (id) => db.get('SELECT * FROM advisors WHERE id = ?', [id]);
function profile(advisorId) {
  const a = advisorRow(advisorId) || {};
  const p = db.get('SELECT * FROM billing_profiles WHERE advisor_id = ?', [advisorId]);
  return p || { advisor_id: advisorId, name: a.name || '', email: a.email || '', province: (db.json(a.provinces, [])[0]) || 'on', company: '', address: '', city: '', postal_code: '', tax_number: '' };
}
function saveProfile(advisorId, b) {
  const row = {
    name: U.truncate(b.name, 100), company: U.truncate(b.company, 120) || null, email: U.normEmail(b.email),
    address: U.truncate(b.address, 160), city: U.truncate(b.city, 80), province: String(b.province || '').toLowerCase(),
    postal_code: U.normPostal(b.postal_code) || '', tax_number: U.truncate(b.tax_number, 30) || null, updated_at: U.sqlNow(),
  };
  if (!row.name) throw new BillingError('Enter the name to put on your invoices.', 'name');
  if (!U.isEmail(row.email)) throw new BillingError('Enter a valid billing email.', 'email');
  if (!row.address || !row.city) throw new BillingError('Enter your billing street address and city.', 'address');
  if (!geo.provinceByCode[row.province]) throw new BillingError('Choose your billing province.', 'province');
  if (!row.postal_code) throw new BillingError('Enter a valid Canadian postal code.', 'postal_code');
  if (db.get('SELECT 1 FROM billing_profiles WHERE advisor_id = ?', [advisorId])) db.update('billing_profiles', advisorId, row, 'advisor_id');
  else db.insert('billing_profiles', { advisor_id: advisorId, ...row });
  return profile(advisorId);
}

// ───────────────────────── Lead credits ─────────────────────────
function balance(advisorId) { return db.value('SELECT COALESCE(SUM(delta), 0) FROM lead_credits WHERE advisor_id = ?', [advisorId]) || 0; }
function freeStats(advisorId) {
  const r = db.get(`SELECT COALESCE(SUM(CASE WHEN kind = 'free_grant' THEN delta END), 0) granted,
      COALESCE(SUM(CASE WHEN pool = 'free' AND kind != 'free_grant' THEN delta END), 0) net FROM lead_credits WHERE advisor_id = ?`, [advisorId]);
  const left = Math.max(0, r.granted + r.net);
  return { granted: r.granted, left, used: r.granted - left };
}
/** True when routing may give this agent a lead (exempt agents always; metered agents need a credit). */
function hasCredit(a) { return !isMetered(a) || balance(a.id) > 0; }

function grantFree(advisorId, { userId } = {}) {
  if (db.get("SELECT 1 FROM lead_credits WHERE advisor_id = ? AND kind = 'free_grant'", [advisorId])) return 0;
  const n = Math.max(0, Math.round(Number(settings.get('free_leads')) || 0));
  if (!n) return 0;
  db.insert('lead_credits', { advisor_id: advisorId, delta: n, kind: 'free_grant', pool: 'free', note: `${n} free leads on approval`, user_id: userId || null });
  return n;
}

function openCharge(leadId, advisorId) {
  return db.get("SELECT * FROM lead_credits WHERE lead_id = ? AND advisor_id = ? AND kind = 'lead' AND reversed_at IS NULL ORDER BY id DESC LIMIT 1", [leadId, advisorId]);
}
/** Use a credit for a lead delivered to a metered agent (free first). With no credit left, it's logged as complimentary. */
function charge(lead, advisor, { userId } = {}) {
  if (!isMetered(advisor) || openCharge(lead.id, advisor.id)) return null;
  const free = freeStats(advisor.id).left;
  const pool = free > 0 ? 'free' : balance(advisor.id) > 0 ? 'paid' : 'comp';
  const id = db.insert('lead_credits', { advisor_id: advisor.id, delta: pool === 'comp' ? 0 : -1, kind: 'lead', pool, lead_id: lead.id, user_id: userId || null, note: pool === 'comp' ? 'Delivered with no credit left (assigned by hand)' : null });
  return { id, pool };
}
/** Give back the credit a lead used (lead reassigned, unassigned or accepted as a bad lead). */
function giveBack(leadId, advisorId, kind = 'returned', { userId, claimId, note } = {}) {
  const c = openCharge(leadId, advisorId);
  if (!c) return null;
  db.run('UPDATE lead_credits SET reversed_at = CURRENT_TIMESTAMP WHERE id = ?', [c.id]);
  if (c.pool === 'comp') return { pool: 'comp', delta: 0 };
  db.insert('lead_credits', { advisor_id: advisorId, delta: 1, kind, pool: c.pool, lead_id: leadId, claim_id: claimId || null, user_id: userId || null, note: note || (kind === 'bad_lead' ? 'Bad-lead credit' : 'Lead moved to another agent') });
  return { pool: c.pool, delta: 1 };
}
function adjust(advisorId, delta, note, userId) {
  delta = Math.round(Number(delta) || 0);
  if (!delta) throw new BillingError('Enter a number of credits to add or remove.', 'delta');
  db.insert('lead_credits', { advisor_id: advisorId, delta, kind: 'adjust', pool: 'paid', note: U.truncate(note, 200) || 'Adjusted by an admin', user_id: userId || null });
}

/** Lead routing hook (lib/routing.setAgent): use the new agent's credit, give the previous agent's back. */
function onAssign(lead, advisor, { userId } = {}) {
  if (lead.advisor_id && lead.advisor_id !== advisor.id) giveBack(lead.id, lead.advisor_id, 'returned', { userId });
  return charge(lead, advisor, { userId });
}
function onUnassign(lead, { userId } = {}) { if (lead.advisor_id) giveBack(lead.id, lead.advisor_id, 'returned', { userId, note: 'Lead unassigned' }); }

// ───────────────────────── Lead preferences (agent's own filters) ─────────────────────────
function prefs(a) { const p = db.json(a && a.lead_prefs, {}) || {}; return { provinces: p.provinces || [], categories: p.categories || [], products: p.products || [], min_grade: GRADES.includes(p.min_grade) ? p.min_grade : '', verified_only: !!p.verified_only }; }
function prefsAllow(a, lead) {
  const p = prefs(a);
  if (p.provinces.length && !p.provinces.includes(lead.province)) return false;
  if (p.categories.length && lead.product_category && !p.categories.includes(lead.product_category)) return false;
  // Products narrow their own line only: picking "term life" doesn't block car leads.
  if (p.products.length && lead.product) {
    const { bySlug } = require('../data/products');
    const cat = (bySlug[lead.product] || {}).category || lead.product_category;
    const inLine = p.products.filter((slug) => (bySlug[slug] || {}).category === cat);
    if (inLine.length && !inLine.includes(lead.product)) return false;
  }
  if (p.min_grade && lead.grade && GRADES.indexOf(lead.grade) > GRADES.indexOf(p.min_grade)) return false;
  if (p.verified_only && !lead.phone_verified_at) return false;
  return true;
}

// ───────────────────────── Tax ─────────────────────────
function taxFor(province) {
  const t = (settings.get('tax_rates') || {})[String(province || '').toLowerCase()];
  return t && Number(t.rate) > 0 ? { label: t.label || 'GST', rate: Number(t.rate) } : { label: 'Tax', rate: 0 };
}
function priceFor(p, province) {
  const subtotal = p.leads_per_month * p.price_per_lead_cents;
  const t = taxFor(province);
  const tax = Math.round(subtotal * t.rate / 100);
  return { subtotal, tax, total: subtotal + tax, label: t.label, rate: t.rate, province };
}

// ───────────────────────── Subscriptions ─────────────────────────
function current(advisorId) {
  return db.get("SELECT * FROM subscriptions WHERE advisor_id = ? AND status IN ('active','past_due') ORDER BY id DESC LIMIT 1", [advisorId])
    || db.get("SELECT * FROM subscriptions WHERE advisor_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [advisorId]) || null;
}

function summary(advisorId) {
  const a = advisorRow(advisorId);
  const sub = current(advisorId);
  const bal = balance(advisorId);
  return {
    metered: isMetered(a), balance: bal, free: freeStats(advisorId),
    sub, plan: sub ? plan(sub.plan_id) : null, nextPlan: sub && sub.next_plan_id ? plan(sub.next_plan_id) : null,
    active: !!sub && ['active', 'past_due'].includes(sub.status),
    periodUsed: sub && sub.current_period_start ? db.value("SELECT COUNT(*) FROM lead_credits WHERE advisor_id = ? AND kind = 'lead' AND reversed_at IS NULL AND created_at >= ?", [advisorId, sub.current_period_start]) || 0 : 0,
    openInvoice: db.get("SELECT * FROM invoices WHERE advisor_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", [advisorId]) || null,
    invoices: db.all('SELECT * FROM invoices WHERE advisor_id = ? ORDER BY id DESC LIMIT 24', [advisorId]),
    ledger: db.all('SELECT c.*, l.ref, l.first_name, l.last_name FROM lead_credits c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.advisor_id = ? ORDER BY c.id DESC LIMIT 20', [advisorId]),
    outOfCredits: isMetered(a) && bal <= 0,
    delivered: db.value("SELECT COUNT(*) FROM lead_credits WHERE advisor_id = ? AND kind = 'lead' AND reversed_at IS NULL", [advisorId]) || 0,
  };
}

// ───────────────────────── Invoices ─────────────────────────
function nextNumber() {
  const prefix = String(settings.get('invoice_prefix') || 'INV-');
  const year = new Date().getUTCFullYear();
  let n = Number(db.value("SELECT value FROM settings WHERE key = 'invoice_seq'") || 0);
  let number;
  do { n += 1; number = `${prefix}${year}-${String(n).padStart(5, '0')}`; } while (db.get('SELECT 1 FROM invoices WHERE number = ?', [number]));
  settings.set('invoice_seq', n);
  return number;
}
function seller() {
  const s = settings.all();
  return { name: s.legal_name || s.site_name, trade_name: s.legal_name && s.legal_name !== s.site_name ? s.site_name : '', address: s.mailing_address || '', email: s.email || '', tax_number: s.gst_number || '', site: config.siteUrl };
}
function periodLabel(start, end) { return start && end ? `${U.fmtDate(start, 'short')} – ${U.fmtDate(end, 'short')}` : 'one month from payment'; }

function createInvoice({ advisorId, plan: p, sub, kind = 'new', periodStart, periodEnd, provider = 'manual', dueAt, notes }) {
  const bill = profile(advisorId);
  const price = priceFor(p, bill.province);
  const lines = [{ description: `${p.name} plan: ${p.leads_per_month} exclusive leads (${periodLabel(periodStart, periodEnd)})`, quantity: p.leads_per_month, unit_cents: p.price_per_lead_cents, amount_cents: price.subtotal }];
  return db.tx(() => {
    const id = db.insert('invoices', {
      number: nextNumber(), advisor_id: advisorId, subscription_id: sub ? sub.id : null, plan_id: p.id, kind, status: 'open', lines,
      subtotal_cents: price.subtotal, tax_label: price.label, tax_rate: price.rate, tax_province: bill.province, tax_cents: price.tax, total_cents: price.total,
      leads: p.leads_per_month, period_start: periodStart || null, period_end: periodEnd || null,
      bill_to: { name: bill.name, company: bill.company, email: bill.email, address: bill.address, city: bill.city, province: bill.province, postal_code: bill.postal_code, tax_number: bill.tax_number },
      seller: seller(), provider, notes: notes || null,
      due_at: dueAt || U.sqlNow(Math.max(0, Number(settings.get('invoice_terms_days')) || 7) * 86400000),
    });
    return invoice(id);
  });
}
function invoice(id) {
  const inv = db.get('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!inv) return null;
  return { ...inv, lines: db.json(inv.lines, []), bill_to: db.json(inv.bill_to, {}), seller: db.json(inv.seller, {}) };
}

/**
 * Record a payment and start (or renew) the plan. Idempotent: a paid invoice is never credited twice.
 * @returns {{ invoice, already?: true }}
 */
function markPaid(invoiceId, { method = 'etransfer', ref, note, userId, providerSubId, customerId, now = new Date() } = {}) {
  const out = db.tx(() => {
    const inv = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!inv) throw new BillingError('Invoice not found.');
    if (inv.status === 'paid') return { invoice: invoice(inv.id), already: true };
    if (inv.status !== 'open') throw new BillingError(`This invoice is ${inv.status} and can’t be paid.`);
    const paidAt = toSql(now);
    let start = inv.period_start, end = inv.period_end;
    if (inv.kind !== 'renewal' || !start) { start = paidAt; end = addMonth(paidAt); }
    const p = plan(inv.plan_id);
    db.update('invoices', inv.id, { status: 'paid', paid_at: paidAt, period_start: start, period_end: end, credits_granted: inv.leads, provider: inv.provider || method, provider_ref: ref || inv.provider_ref, updated_at: U.sqlNow() });
    if (inv.kind !== 'renewal' && p) {
      const lines = db.json(inv.lines, []);
      if (lines[0]) { lines[0].description = `${p.name} plan: ${p.leads_per_month} exclusive leads (${periodLabel(start, end)})`; db.update('invoices', inv.id, { lines }); }
    }
    db.insert('payments', { invoice_id: inv.id, advisor_id: inv.advisor_id, amount_cents: method === 'comp' ? 0 : inv.total_cents, method, provider_ref: ref || null, note: note || null, recorded_by: userId || null });
    if (inv.leads > 0) db.insert('lead_credits', { advisor_id: inv.advisor_id, delta: inv.leads, kind: 'plan', pool: 'paid', invoice_id: inv.id, user_id: userId || null, note: `${p ? p.name : 'Plan'} plan · ${inv.number}` });
    if (inv.subscription_id) {
      const sub = db.get('SELECT * FROM subscriptions WHERE id = ?', [inv.subscription_id]);
      db.update('subscriptions', inv.subscription_id, {
        status: 'active', plan_id: inv.plan_id, leads_per_month: inv.leads, price_per_lead_cents: p ? p.price_per_lead_cents : sub.price_per_lead_cents,
        current_period_start: start, current_period_end: end, next_plan_id: sub.next_plan_id === inv.plan_id ? null : sub.next_plan_id,
        provider_sub_id: providerSubId || sub.provider_sub_id, canceled_at: null, updated_at: U.sqlNow(),
      });
    }
    if (customerId) db.run('UPDATE billing_profiles SET stripe_customer_id = ? WHERE advisor_id = ?', [customerId, inv.advisor_id]);
    // The plan, not the default monthly cap, now decides how many leads the agent gets.
    db.run('UPDATE advisors SET monthly_lead_cap = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [inv.advisor_id]);
    db.insert('audit_log', { user_id: userId || null, action: 'paid', entity: 'invoice', entity_id: String(inv.id), data: { number: inv.number, method, total: inv.total_cents } });
    return { invoice: invoice(inv.id) };
  });
  if (!out.already) notifyInvoice(out.invoice, 'paid').catch(() => {});
  return out;
}

function voidInvoice(invoiceId, { userId, note } = {}) {
  const inv = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv) throw new BillingError('Invoice not found.');
  if (inv.status !== 'open') throw new BillingError('Only open invoices can be voided.');
  db.update('invoices', inv.id, { status: 'void', voided_at: U.sqlNow(), notes: [inv.notes, note].filter(Boolean).join('\n') || null, updated_at: U.sqlNow() });
  // A plan that was never paid for doesn't stay pending.
  if (inv.subscription_id) db.run("UPDATE subscriptions SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", [inv.subscription_id]);
  db.insert('audit_log', { user_id: userId || null, action: 'void', entity: 'invoice', entity_id: String(inv.id), data: { number: inv.number } });
}

/** Record a refund (the money itself is returned in Stripe or by e-Transfer). Optionally removes the unused credits it bought. */
function refundInvoice(invoiceId, { userId, note, removeCredits = true } = {}) {
  return db.tx(() => {
    const inv = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!inv) throw new BillingError('Invoice not found.');
    if (inv.status !== 'paid') throw new BillingError('Only paid invoices can be refunded.');
    db.update('invoices', inv.id, { status: 'refunded', refunded_at: U.sqlNow(), notes: [inv.notes, note].filter(Boolean).join('\n') || null, updated_at: U.sqlNow() });
    db.insert('payments', { invoice_id: inv.id, advisor_id: inv.advisor_id, amount_cents: -inv.total_cents, method: 'refund', status: 'refunded', note: note || null, recorded_by: userId || null });
    let removed = 0;
    if (removeCredits) {
      removed = Math.min(inv.credits_granted, Math.max(0, balance(inv.advisor_id)));
      if (removed) db.insert('lead_credits', { advisor_id: inv.advisor_id, delta: -removed, kind: 'adjust', pool: 'paid', invoice_id: inv.id, user_id: userId || null, note: `Unused credits removed on refund of ${inv.number}` });
    }
    db.insert('audit_log', { user_id: userId || null, action: 'refund', entity: 'invoice', entity_id: String(inv.id), data: { number: inv.number, removed } });
    return { removed };
  });
}

// ───────────────────────── Checkout ─────────────────────────
function paymentMethods() {
  const m = [];
  if (stripe.configured()) m.push('card');
  if (settings.get('etransfer_email')) m.push('etransfer');
  if (!m.length) m.push('etransfer'); // invoice with payment instructions; an admin marks it paid
  return m;
}

/**
 * Start buying a plan: saves billing details, creates a pending subscription and an open invoice.
 * Card payments then go to Stripe Checkout (redirect URL returned); e-Transfer shows the invoice.
 */
async function startCheckout(advisorId, planSlug, { method, billing, origin = config.siteUrl } = {}) {
  const a = advisorRow(advisorId);
  if (!a) throw new BillingError('Agent not found.');
  if ((a.status || 'approved') !== 'approved') throw new BillingError('Your account must be approved before you can choose a plan.');
  const p = plan(String(planSlug));
  if (!p || !p.active) throw new BillingError('That plan isn’t available.');
  if (billing) saveProfile(advisorId, billing);
  else if (!db.get('SELECT 1 FROM billing_profiles WHERE advisor_id = ?', [advisorId])) throw new BillingError('Add your billing details first.', 'name');
  const methods = paymentMethods();
  method = methods.includes(method) ? method : methods[0];
  const existing = current(advisorId);
  if (existing && existing.status !== 'pending') throw new BillingError('You already have a plan. Change it from Plan & billing instead.');

  const { sub, inv } = db.tx(() => {
    // One pending purchase at a time: an unpaid earlier attempt is replaced.
    if (existing) {
      for (const o of db.all("SELECT id FROM invoices WHERE subscription_id = ? AND status = 'open'", [existing.id])) voidInvoice(o.id, { note: 'Replaced by a new checkout' });
      db.run("UPDATE subscriptions SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", [existing.id]);
    }
    const subId = db.insert('subscriptions', { advisor_id: advisorId, plan_id: p.id, status: 'pending', leads_per_month: p.leads_per_month, price_per_lead_cents: p.price_per_lead_cents, provider: method === 'card' ? 'stripe' : 'manual' });
    const s = db.get('SELECT * FROM subscriptions WHERE id = ?', [subId]);
    return { sub: s, inv: createInvoice({ advisorId, plan: p, sub: s, kind: 'new', provider: method === 'card' ? 'stripe' : 'manual' }) };
  });
  if (method === 'card') {
    const url = await stripeSession(inv, sub, p, origin);
    return { invoice: inv, sub, redirect: url };
  }
  notifyInvoice(inv, 'issued').catch(() => {});
  return { invoice: inv, sub, redirect: null };
}

async function ensureProduct(p) {
  if (p.stripe_product_id) return p.stripe_product_id;
  const prod = await stripe.call('POST', '/products', { name: `${settings.get('site_name')} ${p.name} plan (${p.leads_per_month} leads a month)`, metadata: { plan: p.slug } });
  db.run('UPDATE plans SET stripe_product_id = ? WHERE id = ?', [prod.id, p.id]);
  return prod.id;
}
async function ensureTaxRate(inv) {
  if (!inv.tax_rate) return null;
  const key = `${inv.tax_province}:${inv.tax_label}:${inv.tax_rate}`;
  const cache = settings.get('stripe_tax_rates') || {};
  if (cache[key]) return cache[key];
  const prov = geo.provinceByCode[inv.tax_province];
  const tr = await stripe.call('POST', '/tax_rates', { display_name: inv.tax_label, percentage: inv.tax_rate, inclusive: false, country: 'CA', state: String(inv.tax_province).toUpperCase(), jurisdiction: prov ? prov.name : undefined, description: `${inv.tax_label} ${inv.tax_rate}%` });
  settings.set('stripe_tax_rates', { ...cache, [key]: tr.id });
  return tr.id;
}
async function stripeSession(inv, sub, p, origin = config.siteUrl) {
  const product = await ensureProduct(p);
  const taxRate = await ensureTaxRate(inv);
  const bill = profile(inv.advisor_id);
  const meta = { invoice_id: inv.id, subscription_id: sub.id, advisor_id: inv.advisor_id };
  const session = await stripe.call('POST', '/checkout/sessions', {
    mode: 'subscription', client_reference_id: inv.id,
    ...(bill.stripe_customer_id ? { customer: bill.stripe_customer_id } : { customer_email: bill.email }),
    line_items: { 0: { quantity: 1, price_data: { currency: 'cad', product, unit_amount: inv.subtotal_cents, recurring: { interval: 'month' } }, ...(taxRate ? { tax_rates: { 0: taxRate } } : {}) } },
    subscription_data: { metadata: meta, description: `${p.name} plan · ${p.leads_per_month} leads a month` },
    metadata: meta,
    success_url: `${origin}/admin/plan/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/plan?_err=${encodeURIComponent('Payment cancelled. Your plan wasn’t started.')}`,
  });
  db.update('invoices', inv.id, { provider: 'stripe', provider_ref: session.id, updated_at: U.sqlNow() });
  return session.url;
}
/** Retry card payment for an open invoice (a new Checkout Session). */
async function payInvoiceByCard(invoiceId, origin) {
  const inv = invoice(invoiceId);
  if (!inv || inv.status !== 'open') throw new BillingError('This invoice can’t be paid online.');
  const sub = db.get('SELECT * FROM subscriptions WHERE id = ?', [inv.subscription_id]);
  if (sub && sub.provider_sub_id) throw new BillingError('This plan renews automatically by card; update the card in Stripe.');
  if (sub) db.update('subscriptions', sub.id, { provider: 'stripe' });
  return stripeSession(inv, sub || { id: null }, plan(inv.plan_id), origin);
}

function invoiceFromMeta(obj) {
  const meta = obj.metadata || {};
  const id = Number(meta.invoice_id || obj.client_reference_id);
  return id ? db.get('SELECT * FROM invoices WHERE id = ?', [id]) : null;
}
/** Success page fallback: confirm the session directly, so the plan starts even before the webhook arrives. */
async function confirmSession(sessionId) {
  const s = await stripe.call('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return completeSession(s);
}
function completeSession(s) {
  const inv = invoiceFromMeta(s);
  if (!inv) return null;
  if (s.status !== 'complete' || !['paid', 'no_payment_required'].includes(s.payment_status)) return { invoice: invoice(inv.id), pending: true };
  return markPaid(inv.id, { method: 'card', ref: s.id, providerSubId: typeof s.subscription === 'string' ? s.subscription : s.subscription && s.subscription.id, customerId: typeof s.customer === 'string' ? s.customer : s.customer && s.customer.id });
}

/** Stripe webhook events. Unknown events are acknowledged and ignored. */
function handleEvent(ev) {
  const o = (ev.data && ev.data.object) || {};
  const subDetails = o.subscription_details || (o.parent && o.parent.subscription_details) || {};
  const stripeSubId = typeof o.subscription === 'string' ? o.subscription : subDetails.subscription || (ev.type.startsWith('customer.subscription') ? o.id : null);
  const sub = stripeSubId ? db.get('SELECT * FROM subscriptions WHERE provider_sub_id = ?', [stripeSubId]) || (subDetails.metadata && subDetails.metadata.subscription_id ? db.get('SELECT * FROM subscriptions WHERE id = ?', [Number(subDetails.metadata.subscription_id)]) : null) : null;
  switch (ev.type) {
    case 'checkout.session.completed':
      return { handled: !!completeSession(o) };
    case 'invoice.paid': {
      if (o.billing_reason === 'subscription_create') {
        const id = Number((subDetails.metadata || {}).invoice_id);
        if (id) return { handled: !!markPaid(id, { method: 'card', ref: o.id, providerSubId: stripeSubId, customerId: o.customer }) };
        return { handled: false };
      }
      if (!sub) return { handled: false };
      const already = db.get('SELECT id FROM invoices WHERE provider_ref = ?', [o.id]);
      if (already) return { handled: !!markPaid(already.id, { method: 'card', ref: o.id }) };
      const line = ((o.lines || {}).data || [])[0] || {};
      const start = line.period && line.period.start ? toSql(line.period.start * 1000) : sub.current_period_end || U.sqlNow();
      const end = line.period && line.period.end ? toSql(line.period.end * 1000) : addMonth(start);
      const p = plan(sub.next_plan_id || sub.plan_id);
      const inv = createInvoice({ advisorId: sub.advisor_id, plan: p, sub, kind: 'renewal', periodStart: start, periodEnd: end, provider: 'stripe', dueAt: start });
      db.update('invoices', inv.id, { provider_ref: o.id });
      return { handled: !!markPaid(inv.id, { method: 'card', ref: o.id }) };
    }
    case 'invoice.payment_failed':
      if (sub && sub.status === 'active') { db.update('subscriptions', sub.id, { status: 'past_due', updated_at: U.sqlNow() }); notifyAgent(sub.advisor_id, 'Your card payment didn’t go through', ['We couldn’t charge your card for your lead plan renewal. Stripe will retry automatically; you can also update your card from the link in Stripe’s email.', `[Open Plan & billing](${config.siteUrl}/admin/plan)`]).catch(() => {}); }
      return { handled: !!sub };
    case 'customer.subscription.updated':
      if (sub) db.update('subscriptions', sub.id, { cancel_at_period_end: o.cancel_at_period_end ? 1 : 0, status: o.status === 'canceled' ? 'canceled' : sub.status, updated_at: U.sqlNow() });
      return { handled: !!sub };
    case 'customer.subscription.deleted':
      if (sub) db.update('subscriptions', sub.id, { status: 'canceled', canceled_at: U.sqlNow(), updated_at: U.sqlNow() });
      return { handled: !!sub };
    default:
      return { handled: false, ignored: true };
  }
}

// ───────────────────────── Plan changes and renewal ─────────────────────────
function activeSub(advisorId) {
  const s = current(advisorId);
  if (!s || !['active', 'past_due'].includes(s.status)) throw new BillingError('You don’t have an active plan.');
  return s;
}
async function setRenewal(advisorId, on, { userId } = {}) {
  const s = activeSub(advisorId);
  if (s.provider === 'stripe' && s.provider_sub_id) await stripe.call('POST', `/subscriptions/${encodeURIComponent(s.provider_sub_id)}`, { cancel_at_period_end: on ? 'false' : 'true' });
  db.update('subscriptions', s.id, { cancel_at_period_end: on ? 0 : 1, updated_at: U.sqlNow() });
  if (!on) for (const o of db.all("SELECT id FROM invoices WHERE subscription_id = ? AND status = 'open' AND kind = 'renewal'", [s.id])) voidInvoice(o.id, { userId, note: 'Renewal turned off' });
  db.insert('audit_log', { user_id: userId || null, action: on ? 'resume' : 'cancel_renewal', entity: 'subscription', entity_id: String(s.id) });
}
/** Switch plan from the next renewal (no proration). */
async function changePlan(advisorId, planSlug, { userId } = {}) {
  const s = activeSub(advisorId);
  const p = plan(String(planSlug));
  if (!p || !p.active) throw new BillingError('That plan isn’t available.');
  if (p.id === s.plan_id) { db.update('subscriptions', s.id, { next_plan_id: null }); return p; }
  if (s.provider === 'stripe' && s.provider_sub_id) {
    const live = await stripe.call('GET', `/subscriptions/${encodeURIComponent(s.provider_sub_id)}`);
    const item = (((live.items || {}).data) || [])[0];
    const bill = profile(advisorId);
    const taxRate = await ensureTaxRate({ tax_rate: taxFor(bill.province).rate, tax_label: taxFor(bill.province).label, tax_province: bill.province });
    await stripe.call('POST', `/subscriptions/${encodeURIComponent(s.provider_sub_id)}`, {
      proration_behavior: 'none',
      items: { 0: { id: item && item.id, price_data: { currency: 'cad', product: await ensureProduct(p), unit_amount: p.monthly_cents, recurring: { interval: 'month' } }, ...(taxRate ? { tax_rates: { 0: taxRate } } : {}) } },
    });
  }
  db.update('subscriptions', s.id, { next_plan_id: p.id, cancel_at_period_end: 0, updated_at: U.sqlNow() });
  // An unpaid renewal invoice is reissued for the new plan.
  for (const o of db.all("SELECT * FROM invoices WHERE subscription_id = ? AND status = 'open' AND kind = 'renewal'", [s.id])) {
    voidInvoice(o.id, { userId, note: 'Plan changed' });
    createInvoice({ advisorId, plan: p, sub: db.get('SELECT * FROM subscriptions WHERE id = ?', [s.id]), kind: 'renewal', periodStart: o.period_start, periodEnd: o.period_end, dueAt: o.due_at });
  }
  db.insert('audit_log', { user_id: userId || null, action: 'change_plan', entity: 'subscription', entity_id: String(s.id), data: { to: p.slug } });
  return p;
}

/** Heartbeat job for e-Transfer / invoice plans: issue renewal invoices, flag overdue renewals, end cancelled plans. */
function renewals(now = new Date()) {
  const noticeMs = Math.max(0, Number(settings.get('renewal_notice_days')) || 7) * 86400000;
  const out = { issued: 0, pastDue: 0, ended: 0 };
  for (const s of db.all("SELECT * FROM subscriptions WHERE provider = 'manual' AND status IN ('active','past_due') AND current_period_end IS NOT NULL")) {
    const end = U.toDate(s.current_period_end);
    if (s.cancel_at_period_end) {
      if (now >= end) { db.update('subscriptions', s.id, { status: 'canceled', canceled_at: toSql(now), updated_at: U.sqlNow() }); out.ended++; }
      continue;
    }
    if (now.getTime() >= end.getTime() - noticeMs) {
      const have = db.get("SELECT id FROM invoices WHERE subscription_id = ? AND kind = 'renewal' AND period_start = ? AND status != 'void'", [s.id, s.current_period_end]);
      if (!have) {
        const p = plan(s.next_plan_id || s.plan_id);
        if (p) { const inv = createInvoice({ advisorId: s.advisor_id, plan: p, sub: s, kind: 'renewal', periodStart: s.current_period_end, periodEnd: addMonth(s.current_period_end), dueAt: s.current_period_end }); out.issued++; notifyInvoice(inv, 'renewal').catch(() => {}); }
      }
    }
    if (now >= end && s.status === 'active') {
      db.update('subscriptions', s.id, { status: 'past_due', updated_at: U.sqlNow() });
      out.pastDue++;
      notifyAgent(s.advisor_id, 'Your lead plan renewal is due', ['Your plan period has ended and the renewal invoice isn’t paid yet. Leads you’ve already paid for still come through; new credits are added once the payment is confirmed.', `[Open Plan & billing](${config.siteUrl}/admin/plan)`]).catch(() => {});
    }
  }
  return out;
}

// ───────────────────────── Bad-lead claims ─────────────────────────
function claimFor(leadId, advisorId) { return db.get('SELECT * FROM lead_claims WHERE lead_id = ? AND advisor_id = ? ORDER BY id DESC LIMIT 1', [leadId, advisorId]); }
function canClaim(lead, advisorId, now = new Date()) {
  const c = openCharge(lead.id, advisorId);
  if (!c || c.pool === 'comp') return { ok: false, why: 'This lead didn’t use a credit.' };
  const prev = claimFor(lead.id, advisorId);
  if (prev && prev.status !== 'rejected') return { ok: false, why: prev.status === 'open' ? 'You’ve reported this lead; we’re reviewing it.' : 'This lead was already credited.', claim: prev };
  if (prev && prev.status === 'rejected') return { ok: false, why: 'This report was reviewed and not credited.', claim: prev };
  const days = Math.max(0, Number(settings.get('bad_lead_window_days')) || 7);
  const deadline = U.toDate(c.created_at).getTime() + days * 86400000;
  if (now.getTime() > deadline) return { ok: false, why: `Bad leads can be reported within ${days} days of delivery.` };
  return { ok: true, deadline: new Date(deadline), days };
}
function fileClaim(lead, advisorId, { reason, details, userId } = {}) {
  if (!CLAIM_REASONS[reason]) throw new BillingError('Choose a reason.', 'reason');
  const chk = canClaim(lead, advisorId);
  if (!chk.ok) throw new BillingError(chk.why);
  const id = db.insert('lead_claims', { lead_id: lead.id, advisor_id: advisorId, reason, details: U.truncate(details, 1000) || null });
  db.insert('lead_events', { lead_id: lead.id, type: 'bad_lead_reported', user_id: userId || null, data: { reason: CLAIM_REASONS[reason], details: U.truncate(details, 200) || undefined } });
  notifyManagers(`Bad-lead report: ${lead.ref}`, [`An agent reported lead **${lead.ref}** as a bad lead: ${CLAIM_REASONS[reason]}.`, details ? `> ${U.truncate(details, 500)}` : '', `[Review bad-lead reports](${config.siteUrl}/admin/billing/claims)`]).catch(() => {});
  return id;
}
function decideClaim(claimId, { approve, note, userId, markJunk } = {}) {
  const c = db.get('SELECT * FROM lead_claims WHERE id = ?', [claimId]);
  if (!c) throw new BillingError('Report not found.');
  if (c.status !== 'open') throw new BillingError('This report was already decided.');
  db.tx(() => {
    db.update('lead_claims', c.id, { status: approve ? 'approved' : 'rejected', decided_by: userId || null, decided_at: U.sqlNow(), decision_note: U.truncate(note, 500) || null });
    if (approve) giveBack(c.lead_id, c.advisor_id, 'bad_lead', { userId, claimId: c.id });
    if (approve && markJunk) db.run("UPDATE leads SET status = 'junk', stage_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [c.lead_id]);
    db.insert('lead_events', { lead_id: c.lead_id, type: approve ? 'bad_lead_credited' : 'bad_lead_declined', user_id: userId || null, data: { note: U.truncate(note, 200) || undefined } });
  });
  const lead = db.get('SELECT ref FROM leads WHERE id = ?', [c.lead_id]) || {};
  notifyAgent(c.advisor_id, approve ? `Credit returned for lead ${lead.ref}` : `Your bad-lead report for ${lead.ref}`, [approve ? `We reviewed your report and returned the lead credit to your balance.` : `We reviewed your report and couldn’t credit this lead.`, note ? `Note from our team: ${U.truncate(note, 500)}` : '', `[Open Plan & billing](${config.siteUrl}/admin/plan)`]).catch(() => {});
}

// ───────────────────────── Emails ─────────────────────────
function mailer() { return require('./mailer'); }
async function notifyAgent(advisorId, subject, lines) {
  const a = advisorRow(advisorId);
  const p = db.get('SELECT email FROM billing_profiles WHERE advisor_id = ?', [advisorId]);
  const to = (p && p.email) || (a && a.email);
  if (!to || (a && a.is_demo)) return;
  await mailer().sendEmail({ to, kind: 'notification', track: false, subject, bodyMd: lines.filter(Boolean).join('\n\n') });
}
async function notifyManagers(subject, lines) {
  const to = new Set(db.all("SELECT email FROM users WHERE active = 1 AND role IN ('admin','agent_manager')").map((u) => u.email));
  for (const addr of to) await mailer().sendEmail({ to: addr, kind: 'notification', track: false, subject, bodyMd: lines.filter(Boolean).join('\n\n') });
}
async function notifyInvoice(inv, event) {
  const link = `${config.siteUrl}/admin/plan/invoices/${inv.id}`;
  const s = settings.all();
  const pay = s.etransfer_email ? `Pay by Interac e-Transfer to **${s.etransfer_email}** with **${inv.number}** in the message. ${s.payment_instructions || ''}` : (s.payment_instructions || '');
  const subjects = { issued: `Invoice ${inv.number}: ${cad(inv.total_cents)} due ${U.fmtDate(inv.due_at, 'short')}`, renewal: `Your lead plan renews soon: invoice ${inv.number}`, paid: `Payment received: ${inv.number}` };
  const body = event === 'paid'
    ? [`Thanks — we received **${cad(inv.total_cents)}** for invoice ${inv.number}.`, `${inv.leads} lead credits were added to your balance.`, `[View or print your receipt](${link})`]
    : [`Invoice **${inv.number}** for **${cad(inv.total_cents)}** (${cad(inv.subtotal_cents)} + ${inv.tax_label} ${cad(inv.tax_cents)}) is due ${U.fmtDate(inv.due_at)}.`, pay, `[View or print the invoice](${link})`];
  await notifyAgent(inv.advisor_id, subjects[event] || `Invoice ${inv.number}`, body);
}

// ───────────────────────── Admin overview ─────────────────────────
function overview() {
  const m0 = U.monthStartUtc(0);
  return {
    active: db.value("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'") || 0,
    pastDue: db.value("SELECT COUNT(*) FROM subscriptions WHERE status = 'past_due'") || 0,
    mrr: db.value("SELECT COALESCE(SUM(leads_per_month * price_per_lead_cents), 0) FROM subscriptions WHERE status IN ('active','past_due') AND cancel_at_period_end = 0") || 0,
    revenueMonth: db.value('SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE created_at >= ?', [m0]) || 0,
    openInvoices: db.get("SELECT COUNT(*) n, COALESCE(SUM(total_cents), 0) total FROM invoices WHERE status = 'open'"),
    openClaims: db.value("SELECT COUNT(*) FROM lead_claims WHERE status = 'open'") || 0,
    metered: db.value("SELECT COUNT(*) FROM advisors WHERE billing = 'metered' AND COALESCE(status,'approved') = 'approved'") || 0,
    freeOnly: db.value("SELECT COUNT(*) FROM advisors a WHERE billing = 'metered' AND COALESCE(status,'approved') = 'approved' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.advisor_id = a.id AND s.status IN ('active','past_due'))") || 0,
  };
}

module.exports = {
  DEFAULT_PLANS, CLAIM_REASONS, METHODS, GRADES, BillingError, cad, cadShort, addMonth,
  plans, plan, seedPlans, includedFeatures, isMetered, profile, saveProfile,
  balance, freeStats, hasCredit, grantFree, charge, giveBack, adjust, openCharge, onAssign, onUnassign,
  prefs, prefsAllow, taxFor, priceFor, current, summary,
  createInvoice, invoice, markPaid, voidInvoice, refundInvoice, paymentMethods,
  startCheckout, payInvoiceByCard, confirmSession, completeSession, handleEvent,
  setRenewal, changePlan, renewals, canClaim, fileClaim, decideClaim, claimFor, notifyInvoice, overview,
};
