'use strict';
/** Agent billing: free leads, credits, checkout and invoices, renewals, bad-lead claims, Stripe webhooks, the agents page. */
const { start, stop, client, form } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db');
const settings = require('../src/lib/settings');
const billing = require('../src/lib/billing');
const stripe = require('../src/lib/stripe');
const routing = require('../src/lib/routing');
const U = require('../src/lib/util');

let base;
test.before(async () => {
  base = await start();
  // Only the agents these tests create take leads.
  db.run('UPDATE advisors SET active = 0');
});
test.beforeEach(() => require('../src/lib/tracking').rateLimit.resetAll());
test.after(stop);

const JSONH = { 'content-type': 'application/json', accept: 'application/json' };
const FORMH = { 'content-type': 'application/x-www-form-urlencoded' };
const ts = () => String(Date.now() - 9000);
const flash = (r) => decodeURIComponent(String(r.headers.get('location') || '').replace(/\+/g, ' '));
let n = 0;
const lead = async (province = 'mb', product = 'term-life-insurance', extra = {}) => {
  const r = await (await client()('/api/leads', { method: 'POST', headers: JSONH, body: JSON.stringify({ _ts: ts(), email: `billing.client${++n}@gmail.com`, first_name: 'Bea', last_name: `Client${n}`, phone: `204-555-${String(1000 + n).slice(-4)}`, province, product, ...extra }) })).json();
  assert.equal(r.ok, true, JSON.stringify(r));
  return db.get('SELECT * FROM leads WHERE ref = ?', [r.ref]);
};
async function login(email, password) {
  const req = client();
  const r = await req('/admin/login', { method: 'POST', headers: FORMH, body: form({ email, password, next: '/admin/' }) });
  assert.equal(r.status, 302, `login ${email}`);
  const page = await (await req('/admin/account')).text();
  return { req, csrf: page.match(/name="csrf-token" content="([^"]+)"/)[1] };
}
const admin = () => login('admin@instasure.test', 'correct-horse-battery-staple');

async function registerAgent(email, provinces = ['mb']) {
  const req = client();
  const fd = new FormData();
  const fields = { first_name: 'Paula', last_name: 'Payer', email, phone: '204-555-0777', licence_number: 'MB-778899', password: 'paula-password-123', password_confirm: 'paula-password-123', attest: 'on', _ts: ts() };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const p of provinces) fd.append('provinces', p);
  fd.append('categories', 'life');
  const r = await req('/admin/register', { method: 'POST', body: fd, headers: { origin: base } });
  assert.equal(r.status, 303, 'registered without a photo');
  return { req, a: db.get('SELECT * FROM advisors WHERE email = ?', [email]) };
}

test('agents page: SEO, AEO and structured data; nav CTA replaces the phone button; paid prices hidden by default', async () => {
  const res = await client()('/insurance-leads-for-agents/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Insurance Leads for Agents in Canada: 10 Free Leads/);
  const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(desc.length >= 140 && desc.length <= 160, `description ${desc.length} chars`);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'one H1');
  assert.match(html, /<link rel="canonical" href="https:\/\/instasure\.test\/insurance-leads-for-agents\/">/);
  assert.match(html, /og-insurance-leads-for-agents\.jpg/);
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const types = graph.map((g) => g['@type']);
  for (const t of ['Service', 'FAQPage', 'HowTo', 'BreadcrumbList', 'WebPage']) assert.ok(types.includes(t), t);
  const svc = graph.find((g) => g['@type'] === 'Service');
  assert.equal(svc.offers[0].price, '0');
  assert.equal(svc.offers.length, 1, 'paid plans stay out of the page while public pricing is off');
  assert.doesNotMatch(html, /\$1,750/);
  for (const m of html.matchAll(/<img [^>]*>/g)) assert.match(m[0], /alt="/, 'every image has alt text');
  // Header: the For Agents CTA is in; the call button is gone.
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(header, /href="\/insurance-leads-for-agents\/"[^>]*>[\s\S]*?For Agents/);
  assert.doesNotMatch(header, /aria-label="Call customer service/);
  assert.match(await (await client()('/sitemap-core.xml')).text(), /insurance-leads-for-agents/);
  assert.match(await (await client()('/llms.txt')).text(), /For insurance agents/);
  assert.match(await (await client()('/how-we-make-money/')).text(), /flat fee for each request/);

  settings.set('public_pricing', true); require('../src/lib/cache').clear();
  const priced = await (await client()('/insurance-leads-for-agents/')).text();
  assert.match(priced, /\$1,750\/month/);
  settings.set('public_pricing', false); require('../src/lib/cache').clear();
});

test('free leads: approval grants 10, each lead uses one, the 11th waits for a plan', async () => {
  const { req, a } = await registerAgent('paula.payer@gmail.com');
  assert.equal(a.billing, 'metered');
  assert.equal(a.photo, null);
  assert.equal(billing.balance(a.id), 0, 'nothing before approval');
  const { req: adm, csrf } = await admin();
  await adm(`/admin/advisors/${a.id}/status`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'approved' }) });
  assert.equal(billing.balance(a.id), 10);
  assert.ok(db.get("SELECT 1 FROM emails WHERE to_email = 'paula.payer@gmail.com' AND subject LIKE '%approved%' AND text LIKE '%free leads%'"));

  for (let i = 0; i < 10; i++) assert.equal((await lead()).advisor_id, a.id, `free lead ${i + 1}`);
  assert.equal(billing.balance(a.id), 0);
  assert.deepEqual(billing.freeStats(a.id), { granted: 10, left: 0, used: 10 });
  const eleventh = await lead();
  assert.notEqual(eleventh.advisor_id, a.id, 'no credit, no lead');

  const me = await (await req('/admin/me')).text();
  assert.match(me, /You’ve used your 10 free leads/);
  const plan = await (await req('/admin/plan')).text();
  assert.match(plan, /Choose a plan/);
  for (const p of ['Starter', 'Growth', 'Scale']) assert.match(plan, new RegExp(`Choose ${p}`));
  assert.match(plan, /\$35/);
  assert.equal((await req('/admin/billing')).status, 403, 'agents cannot open admin billing');
});

test('checkout by e-Transfer: invoice with HST, admin marks paid, credits and plan start, leads flow again', async () => {
  const a = db.get("SELECT * FROM advisors WHERE email = 'paula.payer@gmail.com'");
  const { req, csrf } = await login('paula.payer@gmail.com', 'paula-password-123');
  assert.equal((await req('/admin/plan/checkout/growth')).status, 200);
  const bad = await req('/admin/plan/checkout/growth', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, name: 'Paula Payer', email: 'paula.payer@gmail.com', address: '', city: '', province: 'on', postal_code: 'M5V 2T6', method: 'etransfer' }) });
  assert.equal(bad.status, 422, 'billing address required');
  const r = await req('/admin/plan/checkout/growth', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, name: 'Paula Payer', company: 'Payer Insurance Inc.', email: 'paula.payer@gmail.com', address: '1 King St W', city: 'Toronto', province: 'on', postal_code: 'm5v2t6', method: 'etransfer' }) });
  assert.equal(r.status, 303);
  const inv = db.get('SELECT * FROM invoices WHERE advisor_id = ? ORDER BY id DESC', [a.id]);
  assert.match(r.headers.get('location'), new RegExp(`/admin/plan/invoices/${inv.id}`));
  assert.equal(inv.status, 'open');
  assert.match(inv.number, /^INV-\d{4}-00001$/);
  assert.equal(inv.subtotal_cents, 175000);
  assert.equal(inv.tax_label, 'HST');
  assert.equal(inv.tax_cents, 22750, '13% Ontario HST');
  assert.equal(inv.total_cents, 197750);
  assert.equal(JSON.parse(inv.bill_to).postal_code, 'M5V 2T6');
  assert.match(await (await req(`/admin/plan/invoices/${inv.id}`)).text(), /\$1,977\.50/);
  assert.equal(billing.current(a.id).status, 'pending');
  assert.equal((await client()(`/admin/plan/invoices/${inv.id}`)).status, 302, 'signed-out users are sent to log in');

  const { req: adm, csrf: ac } = await admin();
  const paid = await adm(`/admin/billing/invoices/${inv.id}/paid`, { method: 'POST', headers: FORMH, body: form({ _csrf: ac, method: 'etransfer', ref: 'CA1234' }) });
  assert.match(flash(paid), /50 lead credits added/);
  assert.equal(billing.balance(a.id), 50);
  const sub = billing.current(a.id);
  assert.equal(sub.status, 'active');
  assert.equal(sub.leads_per_month, 50);
  assert.ok(sub.current_period_end > sub.current_period_start);
  assert.equal(db.value('SELECT monthly_lead_cap FROM advisors WHERE id = ?', [a.id]), null, 'plan replaces the default cap');
  assert.equal(billing.markPaid(inv.id, { method: 'etransfer' }).already, true, 'idempotent');
  assert.equal(billing.balance(a.id), 50, 'never credited twice');
  assert.ok(db.get("SELECT 1 FROM emails WHERE to_email = 'paula.payer@gmail.com' AND subject LIKE 'Payment received%'"));

  assert.equal((await lead()).advisor_id, a.id, 'leads flow again');
  assert.equal(billing.balance(a.id), 49);
  assert.match(await (await req('/admin/plan')).text(), /Your current plan/);
  assert.match(await (await adm('/admin/billing')).text(), /Paula Payer/);
  assert.match(await (await adm('/admin/billing/invoices.csv')).text(), /INV-\d{4}-00001,.*paid/);
});

test('credits come back when a lead is moved away, and after an approved bad-lead report', async () => {
  const a = db.get("SELECT * FROM advisors WHERE email = 'paula.payer@gmail.com'");
  const other = db.insert('advisors', { slug: 'in-house-' + Date.now(), name: 'In House', provinces: ['mb'], categories: ['life'], status: 'approved', active: 0 });
  const l = await lead();
  assert.equal(l.advisor_id, a.id);
  const before = billing.balance(a.id);
  routing.assignTo(l, other, {});
  assert.equal(billing.balance(a.id), before + 1, 'reassigned → credit returned');
  routing.assignTo(db.get('SELECT * FROM leads WHERE id = ?', [l.id]), a.id, {});
  assert.equal(billing.balance(a.id), before, 'back to them → credit used again');
  db.run('UPDATE advisors SET active = 0 WHERE id = ?', [other]);

  const { req, csrf } = await login('paula.payer@gmail.com', 'paula-password-123');
  assert.match(await (await req(`/admin/leads/${l.id}`)).text(), /Report a bad lead/);
  await req(`/admin/leads/${l.id}/note`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, note: 'Number not in service' }) });
  const c = await req(`/admin/leads/${l.id}/claim`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, reason: 'wrong_contact', details: 'Number not in service, email bounced' }) });
  assert.match(flash(c), /we’ll review/);
  const again = await req(`/admin/leads/${l.id}/claim`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, reason: 'fake' }) });
  assert.match(flash(again), /reviewing it/, 'one report per lead');
  const claim = db.get('SELECT * FROM lead_claims WHERE lead_id = ?', [l.id]);

  const { req: adm, csrf: ac } = await admin();
  assert.match(await (await adm('/admin/billing/claims')).text(), /Number not in service/);
  await adm(`/admin/billing/claims/${claim.id}`, { method: 'POST', headers: FORMH, body: form({ _csrf: ac, decision: 'approve', mark_junk: 'on', note: 'Confirmed' }) });
  assert.equal(billing.balance(a.id), before + 1, 'bad lead credited');
  assert.equal(db.value('SELECT status FROM leads WHERE id = ?', [l.id]), 'junk');
  assert.equal(billing.canClaim(db.get('SELECT * FROM leads WHERE id = ?', [l.id]), a.id).ok, false);

  // Outside the window, a report is refused.
  const old = await lead();
  db.run("UPDATE lead_credits SET created_at = datetime('now', '-30 days') WHERE lead_id = ?", [old.id]);
  assert.match(billing.canClaim(old, a.id).why, /within 7 days/);
});

test('lead preferences narrow routing; plan changes and renewals', async () => {
  const a = db.get("SELECT * FROM advisors WHERE email = 'paula.payer@gmail.com'");
  const { req, csrf } = await login('paula.payer@gmail.com', 'paula-password-123');
  await req('/admin/preferences', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, accepting_leads: 'on', min_grade: 'A', provinces: 'mb', categories: 'life' }) });
  assert.equal(billing.prefs(db.get('SELECT * FROM advisors WHERE id = ?', [a.id])).min_grade, 'A');
  const low = await lead();
  assert.notEqual(low.grade, 'A');
  assert.notEqual(low.advisor_id, a.id, 'below their minimum grade');
  await req('/admin/preferences', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, accepting_leads: 'on', provinces: 'mb', categories: 'life', products: 'whole-life-insurance' }) });
  assert.notEqual((await lead('mb', 'term-life-insurance')).advisor_id, a.id, 'only whole life wanted');
  assert.equal((await lead('mb', 'whole-life-insurance')).advisor_id, a.id);
  await req('/admin/preferences', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, accepting_leads: 'on' }) });

  // Switch plan at renewal, then let the period run out.
  const ch = await req('/admin/plan/change', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, plan: 'scale' }) });
  assert.match(flash(ch), /switches to Scale/);
  let sub = billing.current(a.id);
  db.run("UPDATE subscriptions SET current_period_end = datetime('now', '+2 days') WHERE id = ?", [sub.id]);
  sub = billing.current(a.id);
  assert.equal(billing.renewals().issued, 1, 'renewal invoice issued inside the notice window');
  assert.equal(billing.renewals().issued, 0, 'only once');
  const ren = db.get("SELECT * FROM invoices WHERE subscription_id = ? AND kind = 'renewal'", [sub.id]);
  assert.equal(ren.leads, 100, 'renewal uses the new plan');
  assert.equal(ren.period_start, sub.current_period_end);
  const was = billing.balance(a.id);
  billing.markPaid(ren.id, { method: 'etransfer' });
  sub = billing.current(a.id);
  assert.equal(sub.leads_per_month, 100);
  assert.equal(sub.next_plan_id, null);
  assert.equal(sub.current_period_start, ren.period_start, 'renewal period continues from the last one');
  assert.equal(billing.balance(a.id), was + 100, 'unused credits carry over');

  // Turn renewal off: the plan ends at the period end.
  await req('/admin/plan/renewal', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, renew: '0' }) });
  db.run("UPDATE subscriptions SET current_period_end = datetime('now', '-1 minute') WHERE id = ?", [sub.id]);
  assert.equal(billing.renewals().ended, 1);
  assert.equal(db.value('SELECT status FROM subscriptions WHERE id = ?', [sub.id]), 'canceled');
  assert.ok(billing.balance(a.id) > 0, 'paid credits stay usable after cancelling');
  assert.equal((await lead()).advisor_id, a.id, 'still receives leads it paid for');
});

test('Stripe: signed webhooks only, checkout completion and renewals are credited once', async () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
  assert.throws(() => stripe.verifyEvent(body, 't=1,v1=bad', secret), /tolerance|mismatch/);
  assert.equal(stripe.verifyEvent(body, stripe.signPayload(body, secret), secret).id, 'evt_1');
  assert.throws(() => stripe.verifyEvent(body.replace('ping', 'pong'), stripe.signPayload(body, secret), secret), /mismatch/);
  const r = await fetch(`${base}/api/billing/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=x' }, body });
  assert.equal(r.status, 400, 'unsigned webhook rejected');
  assert.equal(stripe.encode({ line_items: { 0: { price_data: { unit_amount: 500 } } }, a: 'b c' }), 'line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=500&a=b%20c');

  // A second agent buys by card (the Stripe calls themselves are not made in tests).
  const id = db.insert('advisors', { slug: 'card-agent', name: 'Card Agent', email: 'card.agent@gmail.com', provinces: ['ab'], categories: ['life'], status: 'approved', active: 1, billing: 'metered' });
  billing.saveProfile(id, { name: 'Card Agent', email: 'card.agent@gmail.com', address: '1 Main St', city: 'Calgary', province: 'ab', postal_code: 'T2P 1J9' });
  const p = billing.plan('starter');
  const subId = db.insert('subscriptions', { advisor_id: id, plan_id: p.id, status: 'pending', leads_per_month: 10, price_per_lead_cents: 4000, provider: 'stripe' });
  const inv = billing.createInvoice({ advisorId: id, plan: p, sub: db.get('SELECT * FROM subscriptions WHERE id = ?', [subId]), provider: 'stripe' });
  assert.equal(inv.tax_label, 'GST');
  assert.equal(inv.total_cents, 42000, '$400 + 5% GST');
  const session = { id: 'cs_test_1', status: 'complete', payment_status: 'paid', client_reference_id: String(inv.id), metadata: { invoice_id: String(inv.id) }, subscription: 'sub_123', customer: 'cus_123' };
  assert.equal(billing.handleEvent({ type: 'checkout.session.completed', data: { object: session } }).handled, true);
  assert.equal(billing.balance(id), 10);
  billing.handleEvent({ type: 'invoice.paid', data: { object: { id: 'in_1', billing_reason: 'subscription_create', subscription: 'sub_123', subscription_details: { metadata: { invoice_id: String(inv.id) } } } } });
  assert.equal(billing.balance(id), 10, 'the first invoice.paid duplicates checkout and is ignored');
  assert.equal(db.value('SELECT stripe_customer_id FROM billing_profiles WHERE advisor_id = ?', [id]), 'cus_123');

  const now = Math.floor(Date.now() / 1000);
  const cycle = { id: 'in_2', billing_reason: 'subscription_cycle', subscription: 'sub_123', lines: { data: [{ period: { start: now, end: now + 30 * 86400 } }] } };
  billing.handleEvent({ type: 'invoice.paid', data: { object: cycle } });
  billing.handleEvent({ type: 'invoice.paid', data: { object: cycle } });
  assert.equal(billing.balance(id), 20, 'renewal credited once');
  assert.equal(db.value("SELECT COUNT(*) FROM invoices WHERE advisor_id = ? AND kind = 'renewal'", [id]), 1);
  billing.handleEvent({ type: 'invoice.payment_failed', data: { object: { id: 'in_3', subscription: 'sub_123' } } });
  assert.equal(billing.current(id).status, 'past_due');
  billing.handleEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_123' } } });
  assert.equal(db.value('SELECT status FROM subscriptions WHERE id = ?', [subId]), 'canceled');
  assert.equal(billing.handleEvent({ type: 'customer.created', data: { object: {} } }).ignored, true);
});

test('admin billing pages, plan editing, manual invoices and in-house agents', async () => {
  const { req: adm, csrf } = await admin();
  for (const url of ['/admin/billing', '/admin/billing/invoices', '/admin/billing/plans', '/admin/billing/claims', '/admin/billing/settings']) assert.equal((await adm(url)).status, 200, url);
  const starter = billing.plan('starter');
  await adm('/admin/billing/plans', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, id: starter.id, name: 'Starter', leads_per_month: '12', price_per_lead: '39.50', tagline: 'x', sort: '1', active: 'on' }) });
  assert.equal(billing.plan('starter').price_per_lead_cents, 3950);
  assert.equal(billing.plan('starter').monthly_cents, 47400);

  await adm('/admin/billing/settings', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, billing_enabled: 'on', free_leads: '5', bad_lead_window_days: '10', invoice_prefix: 'IS-', invoice_terms_days: '7', renewal_notice_days: '7', gst_number: '123456789 RT0001', etransfer_email: 'billing@instasure.test', payment_instructions: 'Pay us', rate_on: '13', label_on: 'HST', rate_ab: '5', label_ab: 'GST' }) });
  assert.equal(settings.get('free_leads'), 5);

  assert.equal(settings.get('tax_rates').on.rate, 13);

  // In-house agents are never billed and always get leads.
  const house = db.insert('advisors', { slug: 'house-' + Date.now(), name: 'House Agent', provinces: ['nb'], categories: ['life'], status: 'approved', active: 1 });
  assert.equal((await lead('nb')).advisor_id, house);
  assert.equal(billing.balance(house), 0);
  const metered = db.insert('advisors', { slug: 'cheque-' + Date.now(), name: 'Cheque Agent', email: 'cheque.agent@gmail.com', provinces: ['nb'], categories: ['life'], status: 'approved', active: 0 });
  await adm(`/admin/billing/agents/${metered}`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, action: 'mode', billing: 'metered' }) });
  assert.equal(billing.balance(metered), 5, 'switching to pay-per-lead grants the free leads');
  const r = await adm(`/admin/billing/agents/${metered}`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, action: 'invoice', plan: 'starter', paid_method: 'cheque', address: '9 Water St', city: 'Moncton', province: 'nb', postal_code: 'E1C 4B5' }) });
  assert.equal(r.status, 303);
  const inv = db.get('SELECT * FROM invoices WHERE advisor_id = ?', [metered]);
  assert.equal(inv.status, 'paid');
  assert.match(inv.number, /^IS-/);
  assert.equal(inv.tax_cents, Math.round(47400 * 0.15), 'NB HST 15%');
  assert.equal(JSON.parse(inv.seller).tax_number, '123456789 RT0001');
  assert.equal(billing.balance(metered), 17);
  await adm(`/admin/billing/agents/${metered}`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, action: 'adjust', delta: '-2', note: 'Goodwill correction' }) });
  assert.equal(billing.balance(metered), 15);
  const rf = await adm(`/admin/billing/invoices/${inv.id}/refund`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, note: 'Cancelled in week one', remove_credits: 'on' }) });
  assert.match(flash(rf), /Refund recorded · 12 unused credits removed/);
  assert.equal(db.value('SELECT status FROM invoices WHERE id = ?', [inv.id]), 'refunded');
  assert.equal(U.money(billing.overview().mrr / 100) !== undefined, true);
  // Stripe keys from the admin: validated, write-only, and they switch card payments on.
  assert.equal(stripe.configured(), false);
  const badKey = await adm('/admin/billing/settings', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, free_leads: '5', stripe_secret_key: 'pk_test_wrongkind123456' }) });
  assert.match(flash(badKey), /doesn’t look like a Stripe secret key/);
  await adm('/admin/billing/settings', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, billing_enabled: 'on', free_leads: '5', stripe_secret_key: 'sk_test_abcdefghij1234', stripe_webhook_secret: 'whsec_abcdefghij5678' }) });
  assert.equal(stripe.configured(), true);
  assert.equal(stripe.testMode(), true);
  assert.equal(settings.all().stripe_secret_key, undefined, 'never in the settings passed to views');
  const page = await (await adm('/admin/billing/settings')).text();
  assert.doesNotMatch(page, /abcdefghij1234/, 'the full key is never sent back');
  assert.match(page, /sk_test_…1234 saved/);
  assert.match(page, /On · test mode/);
  const signed = JSON.stringify({ id: 'evt_x', type: 'customer.created', data: { object: {} } });
  const wr = await fetch(`${base}/api/billing/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': stripe.signPayload(signed, 'whsec_abcdefghij5678') }, body: signed });
  assert.equal(wr.status, 200, 'webhook verified with the saved secret');
  await adm('/admin/billing/settings', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, billing_enabled: 'on', free_leads: '5' }) });
  assert.equal(stripe.configured(), true, 'a blank field keeps the saved key');
  await adm('/admin/billing/settings', { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, billing_enabled: 'on', free_leads: '5', clear_stripe: 'on' }) });
  assert.equal(stripe.configured(), false);
});
