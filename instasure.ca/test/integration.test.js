'use strict';
const { start, stop, client, form } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db');
const drip = require('../src/lib/drip');

let base;
test.before(async () => { base = await start(); });
test.after(stop);

const json = (r) => r.json();
function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

test('public pages render with canonical, meta description and valid JSON-LD', async () => {
  const req = client();
  for (const p of ['/', '/life-insurance/', '/car-insurance/ontario/', '/car-insurance/ontario/brampton/', '/super-visa-insurance/ontario/brampton/', '/insurance/alberta/calgary/', '/guides/', '/calculators/life-insurance-needs/', '/advisors/', '/compare/', '/glossary/', '/privacy/']) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
    const html = await r.text();
    assert.match(html, /<link rel="canonical" href="https:\/\/instasure\.test\//, `${p} canonical`);
    assert.match(html, /<meta name="description" content="[^"]{50,}/, `${p} description`);
    const ld = jsonLd(html);
    assert.ok(ld && ld['@graph'].some((n) => n['@type'] === 'InsuranceAgency'), `${p} org schema`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p} exactly one h1`);
  }
});

test('a published guide has Article schema, FAQ and is in the sitemap and llms.txt', async () => {
  const req = client();
  const slug = db.value("SELECT slug FROM posts WHERE status = 'published' ORDER BY id LIMIT 1");
  const html = await (await req(`/guides/${slug}/`)).text();
  const graph = jsonLd(html)['@graph'];
  assert.ok(graph.some((n) => n['@type'] === 'Article' || n['@type'] === 'NewsArticle'));
  assert.ok(graph.some((n) => n['@type'] === 'FAQPage'));
  const sm = await (await req('/sitemap-guides.xml')).text();
  assert.ok(sm.includes(`/guides/${slug}/`));
  const llms = await (await req('/llms.txt')).text();
  assert.ok(llms.includes(`/guides/${slug}/`));
  const mdTwin = await req(`/guides/${slug}.md`);
  assert.equal(mdTwin.headers.get('x-robots-tag'), 'noindex');
});

test('thin programmatic pages are noindex and excluded from the sitemap', async () => {
  const req = client();
  const html = await (await req('/car-insurance/ontario/milton/')).text(); // tier-3 city
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  const sm = await (await req('/sitemap-geo.xml')).text();
  assert.ok(!sm.includes('/car-insurance/ontario/milton/'));
  assert.ok(sm.includes('/car-insurance/ontario/brampton/'));
});

test('robots.txt points to the sitemap and keeps admin/API private', async () => {
  const t = await (await client()('/robots.txt')).text();
  assert.match(t, /Sitemap: https:\/\/instasure\.test\/sitemap\.xml/);
  assert.match(t, /Disallow: \/admin\//);
  assert.match(t, /User-agent: OAI-SearchBot/);
});

test('URL hygiene: uppercase and missing trailing slash 301 to canonical', async () => {
  const r = await client()('/Life-Insurance');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/life-insurance/');
});

test('estimate API returns a range without any personal data', async () => {
  const r = await json(await client()('/api/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'term-life-insurance', quote_inputs: { age: 40, coverage: 750000 } }) }));
  assert.equal(r.ok, true);
  assert.ok(r.estimate.low > 0 && r.estimate.example.includes('40-year-old'));
});

test('lead lifecycle: quote → score → advisor routing → confirmation → drip → click → unsubscribe', async () => {
  const req = client();
  const payload = {
    product: 'term-life-insurance', lead_type: 'quote', first_name: 'Priya', last_name: 'Shah', email: 'priya.shah@gmail.com', phone: '416-555-0199',
    province: 'on', city: 'toronto', timeframe: '30d', consent_marketing: true, quote_inputs: { age: 38, coverage: 750000, term: 20, sex: 'female', smoker: 'no' },
    _ts: String(Date.now() - 10000), _landing: '/term-life-insurance/', _ref: 'https://www.google.com/',
  };
  const r = await json(await req('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) }));
  assert.equal(r.ok, true);
  assert.match(r.redirect, /^\/quote\/results\/IS-[A-Z0-9]{6}\/$/);
  const lead = db.get('SELECT * FROM leads WHERE ref = ?', [r.ref]);
  assert.equal(lead.source, 'organic');
  assert.equal(lead.grade, 'A', `score ${lead.score}`);
  assert.ok(lead.advisor_id, 'routed to a licensed advisor for ON + life');
  assert.equal(lead.consent_marketing, 1);
  const results = await req(r.redirect);
  assert.equal(results.status, 200);
  assert.match(await results.text(), /noindex,nofollow/);

  await new Promise((res) => setTimeout(res, 50));
  const conf = db.get("SELECT * FROM emails WHERE lead_id = ? AND kind = 'transactional'", [lead.id]);
  assert.ok(conf, 'confirmation email recorded');
  assert.match(conf.html, /Unsubscribe/);
  const enr = db.get('SELECT e.*, c.slug FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id WHERE e.lead_id = ?', [lead.id]);
  assert.equal(enr.slug, 'life-health-follow-up');

  const stats = await drip.tick({ now: Date.now() + 3 * 3600 * 1000, ignoreQuietHours: true });
  assert.ok(stats.sent >= 1, JSON.stringify(stats));
  const sent = db.get("SELECT * FROM emails WHERE lead_id = ? AND kind = 'drip' ORDER BY id LIMIT 1", [lead.id]);
  assert.match(sent.html, /\/e\/c\//, 'links are click-tracked');

  const href = sent.html.match(/href="(https:\/\/instasure\.test\/e\/c\/[^"]+)"/)[1].replace(/&amp;/g, '&').replace('https://instasure.test', '');
  const click = await req(href);
  assert.equal(click.status, 302);
  assert.ok(db.get('SELECT click_count FROM emails WHERE id = ?', [sent.id]).click_count === 1);
  const tampered = await req(href.replace(/u=[^&]+/, 'u=' + encodeURIComponent('https://evil.example')));
  assert.equal(tampered.headers.get('location'), '/', 'no open redirect');

  const unsub = sent.html.match(/href="https:\/\/instasure\.test(\/unsubscribe\?[^"]+)"/)[1].replace(/&amp;/g, '&');
  const page = await req(unsub);
  assert.equal(page.status, 200);
  const q = new URLSearchParams(unsub.split('?')[1]);
  await req('/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ l: q.get('l'), s: q.get('s') }) });
  assert.ok(db.get('SELECT unsubscribed_at FROM leads WHERE id = ?', [lead.id]).unsubscribed_at);
  assert.ok(db.get('SELECT 1 FROM suppressions WHERE email = ?', ['priya.shah@gmail.com']));
  assert.equal(db.get('SELECT status FROM enrollments WHERE id = ?', [enr.id]).status, 'unsubscribed');
});

test('CASL: without express consent no marketing drip is sent', async () => {
  const req = client();
  const r = await json(await req('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ product: 'home-insurance', email: 'noconsent@gmail.com', province: 'ab', city: 'calgary', _ts: String(Date.now() - 9000) }) }));
  const lead = db.get('SELECT * FROM leads WHERE ref = ?', [r.ref]);
  await drip.tick({ now: Date.now() + 5 * 3600 * 1000, ignoreQuietHours: true });
  assert.equal(db.value("SELECT COUNT(*) FROM emails WHERE lead_id = ? AND kind = 'drip'", [lead.id]), 0);
  assert.match(db.get('SELECT stop_reason FROM enrollments WHERE lead_id = ?', [lead.id]).stop_reason, /consent/);
});

test('non-serviceable province (QC by default) goes to the waitlist without advisor routing', async () => {
  const r = await json(await client()('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ product: 'life-insurance', email: 'qc.user@gmail.com', postal_code: 'H3Z 2Y7', _ts: String(Date.now() - 9000) }) }));
  const lead = db.get('SELECT * FROM leads WHERE ref = ?', [r.ref]);
  assert.equal(lead.province, 'qc');
  assert.equal(lead.status, 'waitlist');
  assert.equal(lead.advisor_id, null);
});

test('saved (partial) quote is merged when completed, and the abandoned drip stops', async () => {
  const req = client();
  const hdr = { 'content-type': 'application/json', accept: 'application/json' };
  const a = await json(await req('/api/leads', { method: 'POST', headers: hdr, body: JSON.stringify({ lead_type: 'partial', product: 'car-insurance', email: 'saver@gmail.com', province: 'on', consent_marketing: true, _ts: String(Date.now() - 9000) }) }));
  const b = await json(await req('/api/leads', { method: 'POST', headers: hdr, body: JSON.stringify({ lead_type: 'quote', product: 'car-insurance', email: 'saver@gmail.com', first_name: 'Sam', province: 'on', city: 'brampton', _ts: String(Date.now() - 9000) }) }));
  assert.equal(a.ref, b.ref, 'same lead record');
  assert.equal(db.get('SELECT lead_type FROM leads WHERE ref = ?', [a.ref]).lead_type, 'quote');
  await drip.tick({ now: Date.now() + 4 * 3600 * 1000, ignoreQuietHours: true });
  const ab = db.get("SELECT e.status, e.stop_reason FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id WHERE c.slug = 'abandoned-quote' AND e.lead_id = (SELECT id FROM leads WHERE ref = ?)", [a.ref]);
  assert.equal(ab.status, 'stopped');
});

test('honeypot and too-fast submissions are silently dropped', async () => {
  const before = db.value('SELECT COUNT(*) FROM leads');
  await client()('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email: 'bot@spam.com', website: 'http://spam', _ts: String(Date.now()) }) });
  assert.equal(db.value('SELECT COUNT(*) FROM leads'), before);
});

test('admin: auth required, CSRF enforced, direct publish makes a guide live', async () => {
  const req = client();
  assert.equal((await req('/admin/')).status, 302);
  const bad = await req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ email: 'admin@instasure.test', password: 'wrong' }) });
  assert.equal(bad.status, 401);
  const ok = await req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ email: 'admin@instasure.test', password: 'correct-horse-battery-staple', next: '/admin/' }) });
  assert.equal(ok.status, 302);
  const dash = await req('/admin/');
  assert.equal(dash.status, 200);
  const csrf = (await dash.text()).match(/name="csrf-token" content="([^"]+)"/)[1];

  const noToken = await req('/admin/posts', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ title: 'x' }) });
  assert.equal(noToken.status, 403);

  const body = '## What is a test?\n\nTest guide body with a [link](/life-insurance/).';
  const save = await req('/admin/posts', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ _csrf: csrf, title: 'Integration test guide for publishing', slug: 'integration-test-guide', body_md: body, excerpt: 'Testing direct publish.', action: 'publish' }) });
  assert.equal(save.status, 303);
  const live = await req('/guides/integration-test-guide/');
  assert.equal(live.status, 200);
  assert.ok((await (await req('/sitemap-guides.xml')).text()).includes('/guides/integration-test-guide/'));
  assert.ok(db.get("SELECT * FROM indexnow_log ORDER BY id DESC LIMIT 1"), 'IndexNow attempt logged');

  // Renaming a published slug auto-creates a 301
  const id = db.value("SELECT id FROM posts WHERE slug = 'integration-test-guide'");
  await req('/admin/posts', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ _csrf: csrf, id: String(id), title: 'Integration test guide renamed', slug: 'integration-test-renamed', body_md: body, action: 'save' }) });
  const old = await req('/guides/integration-test-guide/');
  assert.equal(old.status, 301);
  assert.equal(old.headers.get('location'), '/guides/integration-test-renamed/');

  const csv = await req('/admin/leads.csv');
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /^ref,created_at,status/);
});

test('first-party analytics beacon stores pageviews and ignores bots', async () => {
  const req = client();
  const before = db.value('SELECT COUNT(*) FROM pageviews');
  await req('/api/t', { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': 'Mozilla/5.0 (iPhone)' }, body: JSON.stringify({ t: 'pv', p: '/life-insurance/', r: 'https://www.google.com/', v: 'abcdefghij12', s: 'sessionid1234', e: true }) });
  await req('/api/t', { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2)' }, body: JSON.stringify({ t: 'pv', p: '/x/' }) });
  assert.equal(db.value('SELECT COUNT(*) FROM pageviews'), before + 1);
  assert.equal(db.get('SELECT source, device FROM pageviews ORDER BY id DESC LIMIT 1').source, 'organic');
  await req('/life-insurance/', { headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' } });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(db.get("SELECT * FROM crawler_hits WHERE bot = 'ClaudeBot' AND path = '/life-insurance/'"));
});
