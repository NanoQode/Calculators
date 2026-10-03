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

test('province and city pages show a dated example-estimates table and declare dateModified', async () => {
  const req = client();
  for (const p of ['/car-insurance/ontario/brampton/', '/life-insurance/ontario/', '/super-visa-insurance/ontario/brampton/']) {
    const html = await (await req(p)).text();
    assert.match(html, /id="examples-h"/, `${p} example table`);
    assert.match(html, /<table[\s\S]*<th scope="row"/, `${p} table rows`);
    assert.match(html, /Updated <time datetime="\d{4}-\d{2}-\d{2}">/, `${p} visible date`);
    const page = jsonLd(html)['@graph'].find((n) => n['@type'] === 'WebPage');
    assert.ok(page && page.dateModified, `${p} dateModified`);
  }
  const life = await (await req('/life-insurance/ontario/toronto/')).text();
  assert.doesNotMatch(life, /Local risk factors/, 'life pages are not priced on local P&C risks');
  const qc = await (await req('/car-insurance/quebec/montreal/')).text();
  assert.doesNotMatch(qc, /French pages are required|advisors licensed in Quebec/, 'no internal notes or advisor promises in waitlisted provinces');
  const llms = await (await req('/llms.txt')).text();
  assert.match(llms, /## Scope/);
  assert.match(llms, /does not underwrite/);
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
  const life = await (await req('/life-insurance/ontario/toronto/')).text();
  assert.doesNotMatch(life, /Local risk factors/, 'life pages are not priced on local P&C risks');
  const qc = await (await req('/car-insurance/quebec/montreal/')).text();
  assert.doesNotMatch(qc, /French pages are required|advisors licensed in Quebec/, 'no internal notes or advisor promises in waitlisted provinces');
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

test('service pages: hub, niche page with specialist desk form, plain service page and product cross-links', async () => {
  const req = client();
  const { services } = require('../src/data/services');
  for (const s of services) {
    const r = await req(s.path);
    assert.equal(r.status, 200, s.path);
    const html = await r.text();
    const graph = jsonLd(html)['@graph'];
    assert.ok(graph.some((n) => n['@type'] === 'FAQPage'), `${s.path} FAQ schema`);
    assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'), `${s.path} breadcrumbs`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${s.path} one h1`);
    assert.equal(/id="specialist"/.test(html), Boolean(s.niche), `${s.path} specialist desk only on niche services`);
  }
  const niche = await (await req('/car-insurance/high-risk-drivers/')).text();
  assert.match(niche, /name="service" value="high-risk-car-insurance"/);
  assert.match(niche, /High-risk auto desk/);
  const ab = await (await req('/car-insurance/accident-benefits-review/')).text();
  assert.match(ab, /<select class="field" name="province" required><option value="">Select…<\/option><option value="on" selected>Ontario<\/option><\/select>/, 'Ontario-only desk only offers Ontario');

  const fun = await (await req('/life-insurance/funeral-expense/')).text();
  assert.match(fun, /<h1[^>]*>Funeral Expense Insurance from \$1 a Day<\/h1>/);
  assert.match(fun, /data-price-claim>About \$0\.\d\d a day \(\$[\d.]+\/mo\) for the example profile: 50-year-old female, non-smoker, \$10,000 simplified-issue/, 'price headline carries its profile and date');
  assert.match(fun, /Funeral expense desk/);
  assert.match(fun, /href="\/life-insurance\/final-expense\/"/, 'links final expense');
  const fq = await (await req('/quote/whole-life-insurance/?service=funeral-expense-insurance&age=50&sex=female&coverage=10000&plan=whole')).text();
  assert.match(fq, /name="qi\[plan\]" value="funeral"/, 'the service, not the query, sets the plan');
  assert.match(fq, /min="5000" max="50000"/, 'small-policy slider');
  const plain = await (await req('/quote/whole-life-insurance/?plan=funeral')).text();
  assert.doesNotMatch(plain, /name="qi\[plan\]"/, 'no small-policy mode without the service');
  const hub = await (await req('/insurance-services/')).text();
  for (const s of services) assert.ok(hub.includes(`href="${s.path}"`), `hub links ${s.path}`);
  assert.ok(jsonLd(hub)['@graph'].some((n) => n['@type'] === 'ItemList'));
  const car = await (await req('/car-insurance/')).text();
  assert.match(car, /href="\/car-insurance\/high-risk-drivers\/"/, 'product page links its services');
  const condo = await (await req('/condo-insurance/')).text();
  assert.match(condo, /id="specialist"/, 'niche product shows its desk');
  const core = await (await req('/sitemap-core.xml')).text();
  assert.ok(core.includes('/insurance-services/'));
  const svcMap = await (await req('/sitemap-services.xml')).text();
  assert.ok(svcMap.includes('/pet-insurance/') && svcMap.includes('/contractor-insurance/roofing/'));
  const llms = await (await req('/llms.txt')).text();
  assert.match(llms, /## Specialty coverage/);
});

test('customer service placeholder number is shown to people but kept out of structured data', async () => {
  const req = client();
  const html = await (await req('/')).text();
  assert.match(html, /href="tel:18000000000"/);
  const ld = JSON.stringify(jsonLd(html));
  assert.doesNotMatch(ld, /800-000-0000|18000000000/);
});

test('specialist routing: desk leads go to an advisor on that desk, else to a licensed generalist with a note', async () => {
  const req = client();
  const hdr = { 'content-type': 'application/json', accept: 'application/json' };
  const send = async (service, email) => json(await req('/api/leads', { method: 'POST', headers: hdr, body: JSON.stringify({ lead_type: 'consult', service, email, first_name: 'Desk', phone: '416-555-0142', province: 'on', timeframe: '30d', _ts: String(Date.now() - 9000) }) }));
  const event = (ref) => {
    const lead = db.get('SELECT * FROM leads WHERE ref = ?', [ref]);
    return { lead, data: JSON.parse(db.get("SELECT data FROM lead_events WHERE lead_id = ? AND type = 'assigned'", [lead.id]).data) };
  };

  const a = await send('high-risk-car-insurance', 'desk.highrisk@gmail.com');
  assert.equal(a.ok, true);
  const ea = event(a.ref);
  assert.equal(ea.lead.service, 'high-risk-car-insurance');
  assert.equal(ea.lead.product, 'car-insurance', 'product inferred from the service');
  assert.equal(ea.data.specialist, true);
  const adv = db.get('SELECT specialties FROM advisors WHERE id = ?', [ea.lead.advisor_id]);
  assert.ok(JSON.parse(adv.specialties).includes('high-risk-car-insurance'));

  const b = await send('cottage-seasonal-insurance', 'desk.cottage@gmail.com');
  const eb = event(b.ref);
  assert.ok(eb.lead.advisor_id, 'still routed');
  assert.equal(eb.data.specialist, false);
  assert.match(eb.data.note, /generalist/);

  const c = await send('not-a-real-desk', 'desk.unknown@gmail.com');
  assert.equal(db.get('SELECT service FROM leads WHERE ref = ?', [c.ref]).service, null, 'unknown services are dropped');
});

test('admin: phone placeholder is flagged, desks are editable, and desk leads show their desk', async () => {
  const req = client();
  await req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ email: 'admin@instasure.test', password: 'correct-horse-battery-staple', next: '/admin/' }) });
  const dash = await (await req('/admin/')).text();
  assert.match(dash, /Customer service number replaced/);
  assert.match(dash, /Specialist desks staffed/);
  const st = await req('/admin/settings');
  assert.equal(st.status, 200);
  assert.match(await st.text(), /name="phone"[^>]*value="1-800-000-0000"/);
  const advId = db.value("SELECT id FROM advisors WHERE specialties LIKE '%high-risk-car-insurance%' LIMIT 1");
  const edit = await (await req(`/admin/advisors/${advId}`)).text();
  assert.match(edit, /name="specialties" value="high-risk-car-insurance" checked/);
  const leadId = db.value("SELECT id FROM leads WHERE service = 'high-risk-car-insurance' LIMIT 1");
  const lead = await (await req(`/admin/leads/${leadId}`)).text();
  assert.match(lead, /High-risk auto desk/);
  const list = await (await req('/admin/leads')).text();
  assert.match(list, /High-risk auto desk/);
});

test('sitemaps: one file per page type, no empty files in the index, legacy geo file still served', async () => {
  const req = client();
  const idx = await (await req('/sitemap.xml')).text();
  const listed = [...idx.matchAll(/<loc>https:\/\/instasure\.test(\/sitemap-[a-z]+\.xml)<\/loc>/g)].map((m) => m[1]);
  for (const f of ['/sitemap-core.xml', '/sitemap-services.xml', '/sitemap-provinces.xml', '/sitemap-cities.xml', '/sitemap-places.xml', '/sitemap-guides.xml']) assert.ok(listed.includes(f), `index lists ${f}`);
  assert.ok(!listed.includes('/sitemap-geo.xml'), 'legacy combined file is not listed');
  const seen = new Set();
  for (const f of listed) {
    const r = await req(f);
    assert.equal(r.status, 200, f);
    const urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(urls.length > 0, `${f} is not empty`);
    for (const u of urls) { assert.ok(!seen.has(u), `${u} listed once`); seen.add(u); }
  }
  assert.ok((await (await req('/sitemap-cities.xml')).text()).includes('/car-insurance/ontario/brampton/'));
  assert.ok((await (await req('/sitemap-places.xml')).text()).includes('/insurance/alberta/calgary/'));
  assert.equal((await req('/sitemap-geo.xml')).status, 200);
  assert.equal((await req('/sitemap-nope.xml')).status, 404);
});

test('robots.txt: AI crawlers are named and kept out of private paths; llms.txt has contact details', async () => {
  const req = client();
  const t = await (await req('/robots.txt')).text();
  for (const ua of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended']) {
    const group = t.split(`User-agent: ${ua}\n`)[1].split('\n\n')[0];
    assert.match(group, /Allow: \//, `${ua} allowed`);
    assert.match(group, /Disallow: \/quote\/results\//, `${ua} kept out of quote results`);
    assert.match(group, /Disallow: \/admin\//, `${ua} kept out of admin`);
  }
  const llms = await (await req('/llms.txt')).text();
  assert.match(llms, /## Contact/);
  assert.match(llms, /\/sitemap\.xml/);
  assert.doesNotMatch(llms, /800-000-0000/, 'placeholder phone is not offered to AI assistants');
});

test('advisor profiles: indexed and marked up as a Person only with a licence on record', async () => {
  const req = client();
  const base = { languages: ['en'], provinces: ['on'], categories: ['life'], active: 1, accepting_leads: 1, is_demo: 0 };
  db.insert('advisors', { ...base, slug: 'test-team-avatar', name: 'Test Advisor Team', title: 'Licensed advisor team', licences: [] });
  db.insert('advisors', { ...base, slug: 'test-licensed-advisor', name: 'Test Licensed Advisor', licences: [{ province: 'on', regulator: 'FSRA', type: 'Life', number: 'TEST-1' }] });
  require('../src/lib/cache').clear();
  const team = await (await req('/advisors/test-team-avatar/')).text();
  assert.match(team, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!jsonLd(team)['@graph'].some((n) => n['@type'] === 'Person'), 'no Person markup without a licence');
  const real = await (await req('/advisors/test-licensed-advisor/')).text();
  assert.doesNotMatch(real, /noindex/);
  assert.ok(jsonLd(real)['@graph'].some((n) => n['@type'] === 'Person'));
  const sm = await (await req('/sitemap-advisors.xml')).text();
  assert.ok(sm.includes('/advisors/test-licensed-advisor/') && !sm.includes('/advisors/test-team-avatar/'));
  db.run("DELETE FROM advisors WHERE slug IN ('test-team-avatar', 'test-licensed-advisor')");
  require('../src/lib/cache').clear();
});

test('authors: Michael Le Chi is seeded, guides are attributed to him, and his byline carries CFP Person markup', async () => {
  const req = client();
  const m = db.get("SELECT * FROM advisors WHERE slug = 'michael-le-chi'");
  assert.ok(m && m.active === 1 && m.accepting_leads === 0 && m.is_demo === 0, 'author profile, not a lead-taking advisor');
  const files = require('node:fs').readdirSync(require('node:path').join(__dirname, '..', 'src', 'content', 'guides')).map((f) => f.replace(/\.md$/, ''));
  for (const f of files) assert.ok(db.value('SELECT author_id FROM posts WHERE slug = ?', [f]), `${f} has an author`);
  const slug = db.value("SELECT slug FROM posts WHERE status = 'published' AND author_id = ? ORDER BY id LIMIT 1", [m.id]);
  const html = await (await req(`/guides/${slug}/`)).text();
  assert.match(html, /href="\/advisors\/michael-le-chi\/"[^>]*rel="author"/);
  const graph = jsonLd(html)['@graph'];
  const art = graph.find((n) => n['@type'] === 'Article' || n['@type'] === 'NewsArticle');
  assert.equal(art.author.name, 'Michael Le Chi');
  const p = graph.find((n) => n['@type'] === 'Person' && n.name === 'Michael Le Chi');
  assert.ok(p.hasCredential.some((c) => /Certified Financial Planner/.test(c.name) && c.recognizedBy.name === 'FP Canada'));
  assert.match(p.image, /\/img\/team\/michael-le-chi\.webp$/);
  const profile = await (await req('/advisors/michael-le-chi/')).text();
  assert.doesNotMatch(profile, /noindex/, 'a credentialled author profile is indexable');
  assert.ok((await (await req('/sitemap-advisors.xml')).text()).includes('/advisors/michael-le-chi/'));
});

test('guide files publish once: new slugs go live with the default author, existing ones are never overwritten', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { publishGuideFiles } = require('../src/db/seed');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guides-'));
  const meta = { title: 'Test Pipeline Guide', slug: 'test-pipeline-guide', seo_title: 'Test Pipeline Guide for Canada', meta_description: 'x'.repeat(130), excerpt: 'A test guide.', category: 'auto', content_type: 'guide', focus_keyword: 'test pipeline guide', products: ['car-insurance'] };
  fs.writeFileSync(path.join(dir, 'test-pipeline-guide.md'), `---\n${JSON.stringify(meta)}\n---\n## What is a test pipeline guide?\n\nBody text.`);
  const first = await publishGuideFiles(dir);
  assert.equal(first.length, 1);
  const row = db.get("SELECT p.status, a.slug AS author FROM posts p JOIN advisors a ON a.id = p.author_id WHERE p.slug = 'test-pipeline-guide'");
  assert.deepEqual({ ...row }, { status: 'published', author: 'michael-le-chi' });
  db.run("UPDATE posts SET title = 'Edited in admin' WHERE slug = 'test-pipeline-guide'");
  assert.equal((await publishGuideFiles(dir)).length, 0, 'second run publishes nothing');
  assert.equal(db.value("SELECT title FROM posts WHERE slug = 'test-pipeline-guide'"), 'Edited in admin');
  require('../src/lib/cache').clear();
  assert.equal((await client()('/guides/test-pipeline-guide/')).status, 200);
  db.run("DELETE FROM posts WHERE slug = 'test-pipeline-guide'");
});

test('startup seeding never back-dates a new guide file on a site that already has guides', () => {
  const { importGuides } = require('../src/db/seed');
  const before = db.value('SELECT COUNT(*) FROM posts');
  assert.ok(before > 0);
  assert.equal(importGuides(), 0, 'nothing imported on an existing site');
  assert.equal(db.value('SELECT COUNT(*) FROM posts'), before);
});

test('insurer and MGA logos: hidden until confirmed, SVG refused, then shown with dimensions, filtered by line', async () => {
  const req = client();
  const settings = require('../src/lib/settings');
  await req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ email: 'admin@instasure.test', password: 'correct-horse-battery-staple', next: '/admin/' }) });
  const page = await (await req('/admin/partners')).text();
  const csrf = page.match(/name="_csrf" value="([^"]+)"/)[1];
  assert.match(page, /Hidden from the site/);
  assert.doesNotMatch(await (await req('/')).text(), /data-partners=/, 'no appointment bands before confirmation');
  assert.doesNotMatch(await (await req('/life-insurance/')).text(), /data-partners=/);

  // A 1×1 PNG with a 320×90 header (the dimension reader only needs IHDR).
  const png = Buffer.from('89504e470d0a1a0a' + '0000000d' + '49484452' + '00000140' + '0000005a' + '0806000000' + '00000000', 'hex');
  const upload = async (fields, file, name, type) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
    if (file) fd.append('logo', new Blob([file], { type }), name);
    return req(`/admin/partners?_csrf=${encodeURIComponent(csrf)}`, { method: 'POST', body: fd });
  };
  const svg = await upload({ name: 'Bad Logo Co', type: 'insurer', show: 'on' }, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'logo.png', 'image/png');
  assert.match(decodeURIComponent(svg.headers.get('location')), /Only PNG, JPEG, WebP or GIF/);
  assert.ok(!settings.get('partners') || !settings.get('partners').some((p) => p.name === 'Bad Logo Co'), 'refused upload adds nothing');

  const mga = await upload({ name: 'Test MGA Partners', type: 'mga', show: 'on', lines: 'life' }, png, 'mga.png', 'image/png');
  assert.equal(mga.status, 303);
  const saved = settings.get('partners').find((p) => p.name === 'Test MGA Partners');
  assert.match(saved.logo, /^\/uploads\/[a-f0-9]{24}\.png$/);
  assert.equal(saved.w, 320); assert.equal(saved.h, 90);
  assert.ok(settings.get('partners').some((p) => p.name === 'Canada Life'), 'existing insurer names carried over');

  await req('/admin/partners/confirm', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ _csrf: csrf, carriers_confirmed: 'on' }) });
  const home = await (await req('/')).text();
  assert.match(home, /data-partners="compact"/, 'footer row');
  assert.match(home, /shown with permission/);
  assert.match(home, /alt="Test MGA Partners"/, 'the home scroller picks up an uploaded logo');
  const life = await (await req('/life-insurance/')).text();
  assert.match(life, /data-partners="band"/);
  assert.match(life, new RegExp(`<img src="${saved.logo}" alt="Test MGA Partners logo" width="320" height="90"`));
  assert.match(life, /MGAs \(managing general agencies\)/);
  const car = await (await req('/car-insurance/')).text();
  assert.doesNotMatch((car.split('data-partners="band"')[1] || '').split('</section>')[0], /Test MGA Partners/, 'life-only MGA not in the car page band');
  const quote = await (await req('/quote/term-life-insurance/')).text();
  assert.match(quote, /data-partners="aside"/);

  const id = saved.id;
  await req(`/admin/partners/${id}/delete`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ _csrf: csrf }) });
  assert.ok(!settings.get('partners').some((p) => p.id === id));
  settings.set('carriers_confirmed', false);
  require('../src/lib/cache').clear();
});

test('home provider scroller: supplied logos under the hero, sized by area, accessible, and switchable in admin', async () => {
  const req = client();
  const settings = require('../src/lib/settings');
  const { providers } = require('../src/data/providers');
  const html = await (await req('/')).text();
  const hero = html.indexOf('<h1'), band = html.indexOf('data-provider-scroller'), products = html.indexOf('id="products-h"');
  assert.ok(hero > 0 && band > hero && band < products, 'scroller sits between the hero and the product cards');
  assert.match(html, /<h2 id="providers-h"[^>]*>Access Canada’s Insurance Provider Network<\/h2>/);
  const section = html.slice(band, html.indexOf('</section>', band));
  const [visible, hidden] = section.split('aria-hidden="true"');
  assert.equal((visible.match(/class="marquee-item"/g) || []).length, providers.length, 'one visible logo per provider');
  assert.equal((hidden.match(/class="marquee-item"/g) || []).length, providers.length, 'a hidden copy for the seamless loop');
  assert.ok(!/alt="[^"]+"/.test(hidden), 'the copy is silent for screen readers');
  for (const p of providers) assert.match(visible, new RegExp(`src="${p.logo}" alt="${p.name}"`), p.name);
  const areas = [...visible.matchAll(/width="(\d+)" height="(\d+)"/g)].map((m) => Number(m[1]) * Number(m[2]));
  const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
  assert.ok(areas.every((a) => Math.abs(a - mean) / mean < 0.1), 'logos get about the same visual area');
  assert.match(section, /data-marquee-toggle/, 'pause button (WCAG 2.2.2)');
  assert.equal((await req(providers[0].logo)).status, 200);

  await req('/admin/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ email: 'admin@instasure.test', password: 'correct-horse-battery-staple', next: '/admin/' }) });
  const csrf = (await (await req('/admin/partners')).text()).match(/name="_csrf" value="([^"]+)"/)[1];
  await req('/admin/partners/scroller', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ _csrf: csrf }) });
  assert.equal(settings.get('provider_scroller'), false);
  assert.doesNotMatch(await (await req('/')).text(), /data-provider-scroller/, 'switched off in admin');
  settings.set('provider_scroller', true);
  require('../src/lib/cache').clear();
});
