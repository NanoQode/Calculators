'use strict';
/** Lead CRM: repeat submissions, merging, deletion, SMS codes, agents, distribution, caps, reports and the pipeline. */
const { start, stop, client, form, dir } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const db = require('../src/db');
const settings = require('../src/lib/settings');
const routing = require('../src/lib/routing');
const sms = require('../src/lib/sms');
const reports = require('../src/lib/reports');
const tasks = require('../src/lib/tasks');
const U = require('../src/lib/util');

let base;
test.before(async () => { base = await start(); });
test.beforeEach(() => require('../src/lib/tracking').rateLimit.resetAll());
test.after(stop);

const JSONH = { 'content-type': 'application/json', accept: 'application/json' };
const FORMH = { 'content-type': 'application/x-www-form-urlencoded' };
const PNG = Buffer.from('89504e470d0a1a0a' + '0000000d' + '49484452' + '00000040' + '00000040' + '0806000000' + '00000000', 'hex');
const ts = () => String(Date.now() - 9000);
const flash = (r) => decodeURIComponent(String(r.headers.get('location') || '').replace(/\+/g, ' '));

async function login(email = 'admin@instasure.test', password = 'correct-horse-battery-staple') {
  const req = client();
  const r = await req('/admin/login', { method: 'POST', headers: FORMH, body: form({ email, password, next: '/admin/' }) });
  assert.equal(r.status, 302, `login ${email}`);
  const page = await (await req('/admin/account')).text();
  const csrf = page.match(/name="csrf-token" content="([^"]+)"/)[1];
  return { req, csrf };
}
function user(email, role, extra = {}) {
  const auth = require('../src/lib/auth');
  return db.insert('users', { email, name: extra.name || email.split('@')[0], role, password_hash: auth.hashPassword('agent-password-123'), active: 1, ...extra });
}
function agent(name, extra = {}) {
  return db.insert('advisors', { slug: U.slugify(name) + '-' + Math.random().toString(36).slice(2, 7), name, email: `${U.slugify(name)}@agents.test`, provinces: ['on'], categories: ['life', 'auto', 'property', 'health', 'business', 'travel'], languages: ['en'], status: 'approved', active: 1, accepting_leads: 1, show_on_site: 0, ...extra });
}
const post = (req, url, body) => req(url, { method: 'POST', headers: JSONH, body: JSON.stringify({ _ts: ts(), ...body }) });

test('repeat submissions update the existing lead and note each extra product', async () => {
  const req = client();
  const a = await (await post(req, '/api/leads', { email: 'Repeat.Person@gmail.com', first_name: 'Rhea', last_name: 'Peat', phone: '416-555-0301', province: 'on', product: 'term-life-insurance', quote_inputs: { age: 40, coverage: 500000 } })).json();
  assert.equal(a.ok, true);
  const b = await (await post(req, '/api/leads', { email: 'repeat.person@gmail.com', product: 'home-insurance', message: 'Also need home cover' })).json();
  assert.equal(b.ok, true);
  assert.equal(b.ref, a.ref, 'same person, same lead reference');
  assert.equal(b.repeat, true);
  const c = await (await post(req, '/api/leads', { email: 'repeat.person@gmail.com', product: 'term-life-insurance', quote_inputs: { age: 40, coverage: 750000 } })).json();
  assert.equal(c.ref, a.ref);

  assert.equal(db.value("SELECT COUNT(*) FROM leads WHERE email = 'repeat.person@gmail.com'"), 1, 'no duplicate lead');
  const lead = db.get("SELECT * FROM leads WHERE email = 'repeat.person@gmail.com'");
  assert.equal(lead.product, 'term-life-insurance', 'primary product kept');
  assert.deepEqual(JSON.parse(lead.products), ['term-life-insurance', 'home-insurance']);
  assert.equal(lead.inquiry_count, 3);
  assert.equal(JSON.parse(lead.quote_inputs).coverage, '750000', 'same product refreshes the quote');
  const inq = db.all('SELECT origin, product, is_new_product FROM lead_inquiries WHERE lead_id = ? ORDER BY id', [lead.id]);
  assert.deepEqual(inq.map((i) => [i.origin, i.product, i.is_new_product]), [['submission', 'term-life-insurance', 0], ['repeat', 'home-insurance', 1], ['repeat', 'term-life-insurance', 0]]);
  const ev = db.get("SELECT data FROM lead_events WHERE lead_id = ? AND type = 'repeat_inquiry' ORDER BY id LIMIT 1", [lead.id]);
  assert.match(JSON.parse(ev.data).note, /Also asked about Home Insurance/i);
  if (lead.advisor_id) assert.ok(db.get("SELECT 1 FROM emails WHERE lead_id = ? AND kind = 'notification' AND subject LIKE 'New product request%'", [lead.id]), 'agent told about the new product');

  // A lost lead that comes back re-opens.
  db.run("UPDATE leads SET status = 'lost' WHERE id = ?", [lead.id]);
  await post(req, '/api/leads', { email: 'repeat.person@gmail.com', product: 'car-insurance' });
  assert.equal(db.value('SELECT status FROM leads WHERE id = ?', [lead.id]), 'new');
});

test('phone matching joins the same person but never a different first name on a shared number', async () => {
  const req = client();
  const a = await (await post(req, '/api/leads', { email: 'sam.one@gmail.com', first_name: 'Sam', phone: '(647) 555-0402', province: 'on', product: 'tenant-insurance' })).json();
  const b = await (await post(req, '/api/leads', { email: 'sam.other.address@gmail.com', first_name: 'sam', phone: '647-555-0402', province: 'on', product: 'car-insurance' })).json();
  assert.equal(b.ref, a.ref, 'same number + same first name = same lead');
  const c = await (await post(req, '/api/leads', { email: 'pat.household@gmail.com', first_name: 'Pat', phone: '6475550402', province: 'on', product: 'car-insurance' })).json();
  assert.notEqual(c.ref, a.ref, 'household number, different person');
});

test('merging existing duplicates keeps the earliest record, moves history and keeps old references working', async () => {
  const mk = (ref, extra) => db.insert('leads', { ref, email: 'dupe.person@gmail.com', status: 'new', lead_type: 'quote', province: 'on', products: '[]', created_at: extra.created_at, ...extra });
  const first = mk('IS-DUP001', { created_at: '2026-09-01 10:00:00', product: 'term-life-insurance', product_category: 'life', first_name: 'Dee' });
  const second = mk('IS-DUP002', { created_at: '2026-09-05 10:00:00', product: 'home-insurance', product_category: 'property', phone: '+14165550777', status: 'quoted', consent_marketing: 1, consent_at: '2026-09-05 10:00:00', consent_text: 'yes' });
  const third = mk('IS-DUP003', { created_at: '2026-09-09 10:00:00', product: 'car-insurance', product_category: 'auto', unsubscribed_at: '2026-09-10 10:00:00' });
  db.insert('lead_events', { lead_id: second, type: 'note', data: { note: 'from the second record' } });
  db.insert('lead_tasks', { lead_id: third, title: 'Call back', due_at: '2026-09-11 10:00:00' });

  const { req, csrf } = await login();
  const page = await (await req('/admin/leads/duplicates')).text();
  assert.match(page, /IS-DUP001/);
  const r = await req('/admin/leads/duplicates/merge', { method: 'POST', headers: FORMH, body: new URLSearchParams([['_csrf', csrf], ['ids', String(first)], ['ids', String(second)], ['ids', String(third)]]).toString() });
  assert.equal(r.status, 303);

  assert.equal(db.value("SELECT COUNT(*) FROM leads WHERE email = 'dupe.person@gmail.com'"), 1);
  const kept = db.get('SELECT * FROM leads WHERE id = ?', [first]);
  assert.equal(kept.ref, 'IS-DUP001');
  assert.equal(kept.phone, '+14165550777', 'missing contact details filled in');
  assert.equal(kept.status, 'quoted', 'furthest-along stage');
  assert.deepEqual(JSON.parse(kept.products).sort(), ['car-insurance', 'home-insurance', 'term-life-insurance']);
  assert.ok(kept.unsubscribed_at, 'an unsubscribe on any record stays an unsubscribe');
  assert.equal(kept.consent_marketing, 0);
  assert.equal(kept.inquiry_count, 3);
  assert.ok(db.get("SELECT 1 FROM lead_events WHERE lead_id = ? AND type = 'note'", [first]), 'timeline moved');
  assert.ok(db.get('SELECT 1 FROM lead_tasks WHERE lead_id = ?', [first]), 'tasks moved');
  // Old references still resolve: results page and the signed unsubscribe link.
  assert.equal((await client()('/quote/results/IS-DUP002/')).status, 200);
  const mailer = require('../src/lib/mailer');
  const unsub = mailer.unsubscribeUrl({ ref: 'IS-DUP003' }).replace('https://instasure.test', '');
  assert.match(await (await client()(unsub)).text(), /dupe\.person|unsubscribe/i);
  assert.equal(require('../src/lib/merge').groups().filter((g) => g.includes(first)).length, 0);
});

test('delete: admins remove one lead or many with everything attached; agent managers cannot', async () => {
  const req = client();
  const refs = [];
  for (let i = 0; i < 3; i++) refs.push((await (await post(req, '/api/leads', { email: `delete.me.${i}@gmail.com`, province: 'on', product: 'travel-insurance' })).json()).ref);
  const ids = refs.map((r) => db.value('SELECT id FROM leads WHERE ref = ?', [r]));
  tasks.create({ leadId: ids[0], title: 'x', dueAt: U.sqlNow(), createdBy: 1 });

  user('manager.delete@instasure.test', 'agent_manager');
  const mgr = await login('manager.delete@instasure.test', 'agent-password-123');
  const denied = await mgr.req('/admin/leads/bulk', { method: 'POST', headers: FORMH, body: new URLSearchParams([['_csrf', mgr.csrf], ['action', 'delete'], ['ids', String(ids[1])]]).toString() });
  assert.match(flash(denied), /Only admins/);
  assert.ok(db.get('SELECT 1 FROM leads WHERE id = ?', [ids[1]]));

  const { req: adm, csrf } = await login();
  const one = await adm(`/admin/leads/${ids[0]}/delete`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf }) });
  assert.equal(one.status, 303);
  assert.equal(db.get('SELECT 1 FROM leads WHERE id = ?', [ids[0]]), undefined);
  assert.equal(db.value('SELECT COUNT(*) FROM lead_inquiries WHERE lead_id = ?', [ids[0]]), 0);
  assert.equal(db.value('SELECT COUNT(*) FROM lead_tasks WHERE lead_id = ?', [ids[0]]), 0);
  assert.equal(db.value('SELECT COUNT(*) FROM emails WHERE lead_id = ?', [ids[0]]), 0);

  const bulk = await adm('/admin/leads/bulk', { method: 'POST', headers: FORMH, body: new URLSearchParams([['_csrf', csrf], ['action', 'delete'], ['ids', String(ids[1])], ['ids', String(ids[2])]]).toString() });
  assert.match(flash(bulk), /2 leads deleted/);
  assert.equal(db.value(`SELECT COUNT(*) FROM leads WHERE id IN (${ids[1]}, ${ids[2]})`), 0);
  assert.ok(db.get("SELECT 1 FROM audit_log WHERE action = 'delete' AND entity = 'leads'"));
});

test('SMS codes: submissions wait for the texted code, then the lead is saved with a verified phone', async () => {
  const otp = require('../src/lib/otp');
  settings.setMany({ sms_provider: 'log', otp_enabled: true, otp_resend_seconds: 15 });
  try {
    assert.equal(otp.active(), true);
    const req = client();
    const html = await (await req('/quote/term-life-insurance/')).text();
    assert.match(html, /data-otp-dialog/, 'the code pop-up is on the page');
    assert.match(html, /id="ph"[^>]*required/, 'phone is required while codes are on');

    const r = await post(req, '/api/leads', { email: 'otp.person@gmail.com', first_name: 'Otto', phone: '416-555-0505', province: 'on', product: 'term-life-insurance' });
    assert.equal(r.status, 202);
    const held = await r.json();
    assert.equal(held.otp, true);
    assert.equal(held.stage, 'code');
    assert.equal(held.phone, '(•••) •••-0505');
    assert.equal(db.value("SELECT COUNT(*) FROM leads WHERE email = 'otp.person@gmail.com'"), 0, 'nothing saved before the code');
    const code = sms.outbox.slice(-1)[0].body.match(/\d{6}/)[0];
    assert.match(db.value("SELECT body FROM sms_messages WHERE kind = 'otp' ORDER BY id DESC LIMIT 1"), /••••••/, 'stored masked');
    assert.equal(db.value('SELECT code_hash FROM otp_requests WHERE token = ?', [held.token]).includes(code), false);

    const wrong = await (await post(req, '/api/otp/verify', { token: held.token, code: code === '000000' ? '111111' : '000000' })).json();
    assert.equal(wrong.ok, false);
    assert.match(wrong.error, /isn’t right/);
    const tooSoon = await (await post(req, '/api/otp/send', { token: held.token })).json();
    assert.equal(tooSoon.ok, false, 'resend has a cooldown');

    const ok = await (await post(req, '/api/otp/verify', { token: held.token, code })).json();
    assert.equal(ok.ok, true);
    assert.match(ok.redirect, /^\/quote\/results\/IS-/);
    const lead = db.get("SELECT * FROM leads WHERE email = 'otp.person@gmail.com'");
    assert.ok(lead.phone_verified_at);
    assert.equal(lead.phone, '+14165550505');
    const again = await (await post(req, '/api/otp/verify', { token: held.token, code })).json();
    assert.equal(again.ref, ok.ref, 'a double submit returns the same lead');
    assert.equal(db.value("SELECT COUNT(*) FROM leads WHERE email = 'otp.person@gmail.com'"), 1);

    // No phone on the form: the pop-up asks for one first.
    const noPhone = await (await post(req, '/api/leads', { email: 'otp.nophone@gmail.com', lead_type: 'partial', product: 'home-insurance' })).json();
    assert.equal(noPhone.stage, 'phone');
    const badPhone = await (await post(req, '/api/otp/send', { token: noPhone.token, phone: '123' })).json();
    assert.equal(badPhone.ok, false);
    const sent = await (await post(req, '/api/otp/send', { token: noPhone.token, phone: '905-555-0606' })).json();
    assert.equal(sent.stage, 'code');

    // Without JavaScript the form redirects to the verify page.
    const plain = await req('/api/leads', { method: 'POST', headers: FORMH, body: form({ email: 'otp.plain@gmail.com', phone: '416-555-0707', province: 'on', lead_type: 'consult', first_name: 'Pl', _ts: ts() }) });
    assert.equal(plain.status, 303);
    const loc = plain.headers.get('location');
    assert.match(loc, /^\/verify\/[A-Za-z0-9_-]+\/$/);
    assert.match(await (await req(loc)).text(), /Enter the code we texted you/);
  } finally {
    settings.setMany({ otp_enabled: false, sms_provider: 'voipms' });
  }
});

test('SMS: VoIP.ms is called with the documented parameters and errors come back with a hint', async () => {
  settings.setMany({ sms_provider: 'voipms', voipms_username: 'ops@example.ca', voipms_did: '4165550100' });
  settings.set('voipms_password', 'api-secret');
  assert.equal(settings.all().voipms_password, undefined, 'the API password never reaches view settings');
  const calls = [];
  sms._setTransport(async (url) => { calls.push(new URL(url)); return calls.length === 1 ? { status: 'success', sms: '987' } : { status: 'ip_not_enabled' }; });
  const ok = await sms.send('(416) 555-0808', 'Hello', { kind: 'test' });
  assert.equal(ok.ok, true);
  const u = calls[0];
  assert.equal(u.origin + u.pathname, 'https://voip.ms/api/v1/rest.php');
  assert.deepEqual(['api_username', 'api_password', 'method', 'did', 'dst', 'message'].map((k) => u.searchParams.get(k)), ['ops@example.ca', 'api-secret', 'sendSMS', '4165550100', '4165550808', 'Hello']);
  const bad = await sms.send('4165550808', 'Hello', { kind: 'test' });
  assert.equal(bad.ok, false);
  assert.match(bad.hint, /allowed IPs/);
  assert.match(db.value("SELECT error FROM sms_messages WHERE kind = 'test' ORDER BY id DESC LIMIT 1"), /ip_not_enabled/);
  // Switched on but not configured: forms keep working without codes.
  settings.set('voipms_password', '');
  settings.set('otp_enabled', true);
  assert.equal(require('../src/lib/otp').active(), false);
  settings.set('otp_enabled', false);
});

test('agent portal: register with photo and licence, wait for approval, then receive and see only own leads', async () => {
  const req = client();
  assert.match(await (await req('/admin/register')).text(), /Join as a licensed agent/);
  const fd = new FormData();
  const fields = { first_name: 'Nora', last_name: 'Agent', email: 'nora.agent@gmail.com', phone: '416-555-0909', licence_number: 'ON-1234567', password: 'nora-password-123', password_confirm: 'nora-password-123', attest: 'on', _ts: ts() };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const p of ['on', 'bc']) fd.append('provinces', p);
  fd.append('categories', 'life');
  fd.append('photo', new Blob([PNG], { type: 'image/png' }), 'me.png');
  const r = await req('/admin/register', { method: 'POST', body: fd, headers: { origin: base } });
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /^\/admin\/me/);
  const a = db.get("SELECT * FROM advisors WHERE email = 'nora.agent@gmail.com'");
  assert.equal(a.status, 'pending');
  assert.equal(a.active, 0);
  assert.equal(a.licence_number, 'ON-1234567');
  assert.deepEqual(JSON.parse(a.provinces), ['on', 'bc']);
  assert.match(a.photo, /^\/uploads\//);
  assert.equal(a.show_on_site, 0);
  assert.equal(a.monthly_lead_cap, 50, 'default cap');
  assert.match(await (await req('/admin/me')).text(), /Waiting for approval/);
  assert.equal((await req('/admin/advisors')).status, 403, 'agents cannot manage agents');
  assert.equal((await client()('/advisors/' + a.slug + '/')).status, 404, 'no public profile');

  // Pending agents get no leads.
  const solo = (await (await post(client(), '/api/leads', { email: 'bc.client@gmail.com', province: 'bc', product: 'term-life-insurance' })).json()).ref;
  assert.notEqual(db.value('SELECT advisor_id FROM leads WHERE ref = ?', [solo]), a.id);

  const { req: adm, csrf } = await login();
  assert.match(await (await adm('/admin/advisors?status=pending')).text(), /Nora Agent/);
  await adm(`/admin/advisors/${a.id}/status`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'approved' }) });
  assert.equal(db.value('SELECT active FROM advisors WHERE id = ?', [a.id]), 1);
  assert.ok(db.get("SELECT 1 FROM emails WHERE to_email = 'nora.agent@gmail.com' AND subject LIKE '%approved%'"));

  const mine = (await (await post(client(), '/api/leads', { email: 'bc.client.two@gmail.com', province: 'bc', product: 'term-life-insurance' })).json()).ref;
  assert.equal(db.value('SELECT advisor_id FROM leads WHERE ref = ?', [mine]), a.id, 'only licensed BC agent');
  const list = await (await req('/admin/leads')).text();
  assert.match(list, new RegExp(mine));
  assert.doesNotMatch(list, /repeat\.person@gmail\.com/, 'agents see only their own leads');
  const perf = await (await req('/admin/me')).text();
  assert.match(perf, /Conversions by month/);
});

test('distribution: round-robin rotation, direct rules, monthly caps and manual assignment above the cap', async () => {
  db.run("UPDATE advisors SET active = 0 WHERE provinces LIKE '%\"ns\"%'");
  const a1 = agent('Rotation One', { provinces: ['ns'] });
  const a2 = agent('Rotation Two', { provinces: ['ns'] });
  settings.setMany({ assignment_mode: 'round_robin', assignment_rules: [] });
  const send = async (i) => db.get('SELECT * FROM leads WHERE ref = ?', [(await (await post(client(), '/api/leads', { email: `ns.rr.${i}@gmail.com`, province: 'ns', product: 'car-insurance' })).json()).ref]);
  const got = [];
  for (let i = 0; i < 4; i++) got.push((await send(i)).advisor_id);
  assert.deepEqual(got.sort(), [a1, a1, a2, a2], 'leads shared evenly');

  db.run('UPDATE advisors SET monthly_lead_cap = 2 WHERE id IN (?, ?)', [a1, a2]);
  const capped = await send(10);
  assert.equal(capped.advisor_id, null, 'both agents at their monthly cap');
  assert.ok(db.get("SELECT 1 FROM lead_events WHERE lead_id = ? AND type = 'assignment_failed'", [capped.id]));
  db.run('UPDATE advisors SET monthly_lead_cap = 3 WHERE id = ?', [a2]);
  assert.equal((await send(11)).advisor_id, a2, 'raising a cap reopens the agent');

  const r = routing.assignTo(capped, a1, { userId: 1 });
  assert.match(r.warnings.join(), /monthly lead cap/, 'admins can assign above the cap');
  assert.equal(db.value('SELECT advisor_id FROM leads WHERE id = ?', [capped.id]), a1);

  db.run('UPDATE advisors SET monthly_lead_cap = NULL WHERE id IN (?, ?)', [a1, a2]);
  settings.set('assignment_rules', [{ province: 'ns', category: 'auto', service: '', advisor_id: a1 }]);
  for (let i = 20; i < 23; i++) assert.equal((await send(i)).advisor_id, a1, 'direct rule wins');
  settings.setMany({ assignment_rules: [], assignment_mode: 'manual' });
  assert.equal((await send(30)).advisor_id, null, 'manual mode leaves leads unassigned');

  const { req, csrf } = await login();
  const lead = db.get("SELECT id FROM leads WHERE email = 'ns.rr.30@gmail.com'");
  await req('/admin/leads/bulk', { method: 'POST', headers: FORMH, body: new URLSearchParams([['_csrf', csrf], ['action', `assign:${a2}`], ['ids', String(lead.id)]]).toString() });
  assert.equal(db.value('SELECT advisor_id FROM leads WHERE id = ?', [lead.id]), a2);
  const page = await (await req('/admin/distribution')).text();
  assert.match(page, /Rotation One/);
  settings.set('assignment_mode', 'best_match');
});

test('agent manager: manages agents and gets the daily report, but not content or settings', async () => {
  const id = user('manager.report@instasure.test', 'agent_manager', { name: 'Morgan Manager', daily_report: 1 });
  assert.equal(db.value('SELECT role FROM users WHERE id = ?', [id]), 'agent_manager');
  const { req } = await login('manager.report@instasure.test', 'agent-password-123');
  for (const p of ['/admin/advisors', '/admin/distribution', '/admin/reports/daily', '/admin/leads', '/admin/pipeline', '/admin/tasks', '/admin/leads/duplicates']) assert.equal((await req(p)).status, 200, p);
  for (const p of ['/admin/settings', '/admin/posts', '/admin/seo', '/admin/users', '/admin/sms']) assert.equal((await req(p)).status, 403, p);
  assert.match(await (await req('/admin/reports/daily')).text(), /Top requests, last 7 days/);

  settings.set('daily_report_last', '');
  const now = new Date();
  const r = await reports.maybeSendDaily(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16)));
  assert.ok(r && r.to.includes('manager.report@instasure.test'));
  const mail = db.get("SELECT subject, html FROM emails WHERE to_email = 'manager.report@instasure.test' ORDER BY id DESC LIMIT 1");
  assert.match(mail.subject, /new yesterday/);
  assert.match(mail.html, /By province/);
  assert.equal(await reports.maybeSendDaily(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17))), null, 'once a day');
  const report = reports.build();
  assert.ok(Number.isInteger(report.week.leads) && Array.isArray(report.topProvinces) && Array.isArray(report.agents));
});

test('pipeline: stage pop-up saves stage, outcome, notes, score and a follow-up; due follow-ups pop up', async () => {
  const ref = (await (await post(client(), '/api/leads', { email: 'pipeline.person@gmail.com', first_name: 'Pia', province: 'on', product: 'whole-life-insurance' })).json()).ref;
  const lead = db.get('SELECT * FROM leads WHERE ref = ?', [ref]);
  const { req, csrf } = await login();
  const page = await (await req(`/admin/leads/${lead.id}`)).text();
  assert.match(page, /data-stage-dialog/);
  assert.match(page, /Needs analysis/);
  const due = new Date(Date.now() - 60000).toISOString();
  const r = await req(`/admin/leads/${lead.id}/update`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'quoted', disposition: 'quote_sent', note: 'Sent 3 options', score_adjustment: '10', task_title: 'Follow up on quote', due_utc: due, task_for: 'me' }) });
  assert.equal(r.status, 303);
  assert.match(flash(r), /stage → Quoted.*score updated.*follow-up scheduled/);
  const after = db.get('SELECT * FROM leads WHERE id = ?', [lead.id]);
  assert.equal(after.status, 'quoted');
  assert.equal(after.disposition, 'quote_sent');
  assert.equal(after.score_adjustment, 10);
  assert.ok(JSON.parse(after.score_breakdown).some((b) => b.category === 'manual' && b.points === 10));
  const ev = JSON.parse(db.value("SELECT data FROM lead_events WHERE lead_id = ? AND type = 'status_change' ORDER BY id DESC LIMIT 1", [lead.id]));
  assert.deepEqual([ev.from, ev.to, ev.disposition_label, ev.note], ['new', 'quoted', 'Quote sent', 'Sent 3 options']);
  const t = db.get('SELECT * FROM lead_tasks WHERE lead_id = ?', [lead.id]);
  assert.equal(t.title, 'Follow up on quote');

  const pop = await (await req('/admin/tasks/due.json')).json();
  assert.ok(pop.tasks.some((x) => x.id === t.id), 'due task pops up');
  await req(`/admin/tasks/${t.id}/snooze`, { method: 'POST', headers: { ...JSONH, 'x-csrf-token': csrf }, body: JSON.stringify({ minutes: 30 }) });
  assert.ok(!(await (await req('/admin/tasks/due.json')).json()).tasks.some((x) => x.id === t.id), 'snoozed');
  assert.equal(await tasks.remindDue() >= 1, true, 'email reminder sent once');
  assert.equal(await tasks.remindDue(), 0);
  await req(`/admin/tasks/${t.id}/done`, { method: 'POST', headers: { ...JSONH, 'x-csrf-token': csrf }, body: '{}' });
  assert.ok(db.value('SELECT done_at FROM lead_tasks WHERE id = ?', [t.id]));

  const board = await (await req('/admin/pipeline')).text();
  for (const label of ['Needs analysis', 'In underwriting', 'Approved (awaiting delivery)', 'Policy issued (won)']) assert.ok(board.includes(label), label);
  assert.match(await (await req('/admin/tasks?show=done')).text(), /Follow up on quote/);
  const lost = await req(`/admin/leads/${lead.id}/update`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'lost', disposition: 'price' }) });
  assert.equal(lost.status, 303);
  assert.equal(db.value('SELECT lost_reason FROM leads WHERE id = ?', [lead.id]), 'Price too high');
});

test('an agent who opens a new lead must add a note to it before opening another', async () => {
  const aid = agent('Note Gate Agent');
  user('note.gate@agents.test', 'advisor', { advisor_id: aid });
  const mk = (ref, status = 'new') => db.insert('leads', { ref, email: `${ref.toLowerCase()}@gmail.com`, first_name: ref, status, lead_type: 'quote', province: 'on', products: '[]', advisor_id: aid });
  const [a, b, c] = [mk('IS-GATEA'), mk('IS-GATEB'), mk('IS-GATEC', 'quoted')];
  const { req, csrf } = await login('note.gate@agents.test', 'agent-password-123');

  // Opening a lead that is already being worked does not hold the agent.
  assert.equal((await req(`/admin/leads/${c}`)).status, 200);
  assert.equal((await req(`/admin/leads/${b}`)).status, 200, 'B is new: now B needs a note');
  const page = await (await req(`/admin/leads/${b}`)).text();
  assert.match(page, /Add a note below/);
  assert.match(page, /name="note"[^>]*required autofocus/);
  assert.ok(db.get("SELECT 1 FROM lead_events WHERE lead_id = ? AND type = 'opened'", [b]), 'first open is on the timeline');

  const blocked = await req(`/admin/leads/${a}`);
  assert.equal(blocked.status, 303);
  assert.match(blocked.headers.get('location'), new RegExp(`^/admin/leads/${b}\\?`));
  assert.match(flash(blocked), /Add a note to IS-GATEB/);
  const work = await req(`/admin/leads/${a}/update`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'contacted' }) });
  assert.equal(work.status, 303);
  assert.equal(db.value('SELECT status FROM leads WHERE id = ?', [a]), 'new', 'cannot work another lead either');
  assert.match(await (await req('/admin/leads')).text(), /before you open another lead/, 'banner on other pages');

  // A stage change without a note does not count; an empty note does not count.
  await req(`/admin/leads/${b}/update`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'contacted' }) });
  await req(`/admin/leads/${b}/note`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, note: '   ' }) });
  assert.equal((await req(`/admin/leads/${a}`)).status, 303);
  await req(`/admin/leads/${b}/note`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, note: 'Left a voicemail, will try at 5' }) });
  assert.equal((await req(`/admin/leads/${a}`)).status, 200, 'released after the note; A is new, so A now needs one');
  await req(`/admin/leads/${a}/update`, { method: 'POST', headers: FORMH, body: form({ _csrf: csrf, status: 'contacted', note: 'Spoke with client, needs analysis booked' }) });
  assert.equal((await req(`/admin/leads/${b}`)).status, 200);

  // Admins are never held, and the switch turns it off for agents.
  const adm = await login();
  const d = mk('IS-GATED');
  const e = mk('IS-GATEE');
  assert.equal((await adm.req(`/admin/leads/${d}`)).status, 200);
  assert.equal((await adm.req(`/admin/leads/${e}`)).status, 200);
  settings.set('require_note_on_new', false);
  assert.equal((await req(`/admin/leads/${d}`)).status, 200);
  assert.equal((await req(`/admin/leads/${e}`)).status, 200);
  settings.set('require_note_on_new', true);
});

test('admin pages render for every role that can open them', async () => {
  const { req } = await login();
  const a = db.value('SELECT id FROM advisors LIMIT 1');
  for (const p of ['/admin/', '/admin/leads', '/admin/pipeline', '/admin/tasks', '/admin/advisors', '/admin/advisors?status=pending', `/admin/advisors/${a}`, `/admin/advisors/${a}/performance`, '/admin/advisors/new', '/admin/distribution', '/admin/reports/daily', '/admin/sms', '/admin/users', '/admin/settings', '/admin/account', '/admin/analytics']) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
  }
});

test('migration: an older database gains the agent manager role without losing users or sessions', () => {
  const file = path.join(dir, 'old.db');
  const { DatabaseSync } = require('node:sqlite');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE advisors (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','advisor','viewer')), advisor_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
      active INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at TEXT NOT NULL, ip TEXT, ua TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (email, name, password_hash, role) VALUES ('old@admin.test', 'Old Admin', 'x', 'admin');
    INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES ('s1', 1, 'c', '2099-01-01');`);
  old.close();
  const out = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const db = require('./src/db'); db.open(process.env.DB_PATH);
    db.insert('users', { email: 'mgr@x.test', name: 'M', password_hash: 'x', role: 'agent_manager' });
    console.log(JSON.stringify({ users: db.value('SELECT COUNT(*) FROM users'), sessions: db.value('SELECT COUNT(*) FROM sessions'), daily: db.value("SELECT daily_report FROM users WHERE email = 'old@admin.test'") }));`],
  { cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PATH: file, NODE_ENV: 'test' } }).toString();
  assert.deepEqual(JSON.parse(out.trim().split('\n').pop()), { users: 2, sessions: 1, daily: 0 });
  fs.rmSync(file, { force: true });
});
