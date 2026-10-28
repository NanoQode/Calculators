'use strict';
require('./helpers');
require('../src/db').open();
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const quote = require('../src/lib/quote-engine');
const scoring = require('../src/lib/scoring');
const { audit } = require('../public/js/seo-audit');
const media = require('../src/lib/media');
const geo = require('../src/data/geo');
const { products } = require('../src/data/products');
const md = require('../src/lib/markdown');
const { parseGuide } = require('../src/db/seed');
const U = require('../src/lib/util');

test('estimate engine: every product returns a sane range with an example profile', () => {
  for (const p of products) {
    const e = quote.estimate(p.slug, quote.DEFAULT_PROFILES[p.quoteFlow]);
    assert.ok(e.low > 0 && e.low <= e.mid && e.mid <= e.high, `${p.slug} ordered range`);
    assert.ok(e.example && e.example.length > 10, `${p.slug} example profile`);
    assert.equal(e.tiers.length, 3, `${p.slug} three tiers`);
    assert.ok(e.asOf, `${p.slug} dated`);
  }
});

test('estimate engine: life premiums rise with age and smoking', () => {
  const p = (age, smoker) => quote.estimate('term-life-insurance', { age, smoker, coverage: 500000, term: 20, sex: 'male' }).mid;
  assert.ok(p(30, 'no') < p(45, 'no') && p(45, 'no') < p(55, 'no'));
  assert.ok(p(35, 'yes') > p(35, 'no') * 2);
});

test('estimate engine: funeral plans price small policies, and the "$1 a day" headline holds for its example profile', () => {
  const { services } = require('../src/data/services');
  const pages = require('../src/lib/pages');
  const f = quote.estimate('whole-life-insurance', { plan: 'funeral', age: 50, sex: 'female', smoker: 'no', coverage: 10000 });
  assert.match(f.example, /\$10,000 simplified-issue funeral expense policy/);
  assert.equal(f.tiers.length, 3);
  const older = quote.estimate('whole-life-insurance', { plan: 'funeral', age: 70, sex: 'female', smoker: 'no', coverage: 10000 });
  const smoker = quote.estimate('whole-life-insurance', { plan: 'funeral', age: 50, sex: 'female', smoker: 'yes', coverage: 10000 });
  assert.ok(older.mid > f.mid && smoker.mid > f.mid, 'price rises with age and smoking');
  assert.equal(quote.estimate('whole-life-insurance', { plan: 'funeral', coverage: 1000000 }).meta.coverage, 50000, 'funeral cover is capped at $50,000');
  for (const sv of services.filter((s) => s.claimDaily)) {
    const e = pages.serviceEstimate(sv);
    assert.ok(e && e.mid * 12 / 365 <= sv.claimDaily, `${sv.slug}: example estimate ${e && e.mid}/mo supports "from $${sv.claimDaily} a day"`);
    assert.ok(sv.h1 && sv.title.includes(`$${sv.claimDaily} a Day`), `${sv.slug} headline`);
  }
});

test('estimate engine: Brampton auto costs more than Ottawa auto', () => {
  const b = quote.estimate('car-insurance', { province: 'on', city: 'brampton', age: 35 }).mid;
  const o = quote.estimate('car-insurance', { province: 'on', city: 'ottawa', age: 35 }).mid;
  assert.ok(b > o);
});

test('postal code → province', () => {
  assert.equal(geo.provinceFromPostal('M5V 2T6'), 'on');
  assert.equal(geo.provinceFromPostal('t2p1j9'), 'ab');
  assert.equal(geo.provinceFromPostal('H3Z 2Y7'), 'qc');
  assert.equal(geo.provinceFromPostal('nope'), null);
});

test('scoring: a complete, consented, phone-verified life quote is grade A; junk is D', () => {
  const rules = scoring.DEFAULT_RULES.map(([name, category, field, operator, value, points], id) => ({ id, name, category, field, operator, value, points }));
  const hot = scoring.evaluate({ lead_type: 'quote', lead_value: 450, coverage: 750000, age: 38, serviceable: true, timeframe: '30d', has_phone: true, has_name: true, email_valid: true, wants_call: true }, rules);
  assert.equal(hot.grade, 'A');
  const junk = scoring.evaluate({ lead_type: 'newsletter', lead_value: 40, serviceable: false, email_valid: false, email_disposable: true }, rules);
  assert.equal(junk.grade, 'D');
  assert.ok(junk.score >= 0 && hot.score <= 100);
});

test('util: phone/email/postal normalisation and CSV injection guard', () => {
  assert.equal(U.normPhone('(416) 555-0199'), '+14165550199');
  assert.equal(U.normPhone('123'), null);
  assert.equal(U.normPostal('m5v2t6'), 'M5V 2T6');
  assert.ok(U.isEmail('a@b.ca') && !U.isEmail('a@b'));
  assert.equal(U.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
});

test('markdown: strips scripts and event handlers, builds a TOC', () => {
  const r = md.render('## How much?\n\n<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))');
  assert.ok(!/script|onerror|javascript:/i.test(r.html));
  assert.equal(r.toc[0].id, 'how-much');
});

test('media: magic-byte sniffing refuses SVG and HTML disguised as images', () => {
  assert.equal(media.sniff(Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')), 'png');
  assert.equal(media.sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
  assert.equal(media.sniff(Buffer.from('<!doctype html><html><body>hi</body></html>')), null);
  assert.throws(() => media.save(Buffer.from('<svg onload=alert(1)></svg>   ')), /PNG, JPEG, WebP or GIF/);
});

test('every launch guide parses and scores ≥ 85 on the SEO/AEO audit', () => {
  const dir = path.join(__dirname, '..', 'src', 'content', 'guides');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 18);
  for (const f of files) {
    const { meta, body } = parseGuide(path.join(dir, f));
    const r = audit({ title: meta.title, seoTitle: meta.seo_title, metaDescription: meta.meta_description, slug: meta.slug, bodyMd: body, focusKeyword: meta.focus_keyword, faq: meta.faq, takeaways: meta.takeaways, sources: meta.sources, products: meta.products, contentType: meta.content_type, siteHost: 'instasure.test' });
    assert.ok(r.score >= 85, `${f} scored ${r.score}: ${r.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
    for (const p of meta.products) assert.ok(products.some((x) => x.slug === p), `${f}: unknown product ${p}`);
  }
});

test('keyword map: valid rows, modelled volumes labelled, every target page exists', () => {
  require('../src/db/seed').seed({ quiet: true });
  const { keywords } = require('../src/data/keywords');
  const pages = require('../src/lib/pages');
  const known = new Set(pages.allPages().map((p) => p.path));
  const extra = /^\/(quote\/([a-z-]+\/)?|calculators\/[a-z-]+\/)$/; // quote flows and calculators are not in the sitemap list
  const seen = new Set();
  assert.ok(keywords.length > 500);
  for (const k of keywords) {
    assert.ok(!seen.has(k.keyword), `duplicate keyword ${k.keyword}`);
    seen.add(k.keyword);
    assert.ok(['national', 'provincial', 'local'].includes(k.level), k.keyword);
    assert.equal(k.volume_source, 'model', `${k.keyword} must be labelled as modelled`);
    assert.ok(k.volume >= 10 && k.priority >= 1 && k.priority <= 5, k.keyword);
    if (k.product) assert.ok(products.some((p) => p.slug === k.product), `${k.keyword}: unknown product ${k.product}`);
    if (k.target_path) assert.ok(known.has(k.target_path) || extra.test(k.target_path), `${k.keyword}: no page at ${k.target_path}`);
    else assert.ok(k.notes, `${k.keyword}: unmapped keywords need a plan in notes`);
  }
});

test('rate index: median per product × province, hidden below the minimum sample, test leads excluded', () => {
  const db = require('../src/db');
  const pages = require('../src/lib/pages');
  db.run("DELETE FROM leads WHERE ref LIKE 'RI-%'");
  const add = (i, product, province, mid, isTest = 0) => db.run(
    'INSERT INTO leads(ref, lead_type, product, province, estimate, is_test) VALUES(?, ?, ?, ?, ?, ?)',
    [`RI-${product}-${province}-${i}-${isTest}`, 'quote', product, province, JSON.stringify({ mid }), isTest]);
  for (let i = 1; i <= 25; i++) add(i, 'tenant-insurance', 'nb', i === 25 ? 1000 : 20 + i); // one outlier
  for (let i = 1; i <= 24; i++) add(i, 'tenant-insurance', 'pe', 30);
  for (let i = 1; i <= 30; i++) add(i, 'tenant-insurance', 'pe', 999, 1); // test leads never count
  const rows = pages.rateIndexRows().filter((r) => r.product === 'tenant-insurance');
  assert.deepEqual(rows.map((r) => r.province), ['nb']);
  assert.equal(rows[0].n, 25);
  assert.equal(rows[0].mid, 33); // median of 21..44 plus the outlier is 33; a mean would be ~71
  db.run("DELETE FROM leads WHERE ref LIKE 'RI-%'");
});

test('content dates: sitemap lastmod and "as of" follow the review date and editor overrides, not today', () => {
  const db = require('../src/db');
  const settings = require('../src/lib/settings');
  const pages = require('../src/lib/pages');
  const before = settings.get('estimates_reviewed_at');
  settings.set('estimates_reviewed_at', '2026-01-15');
  pages.invalidate();
  const path = '/car-insurance/ontario/brampton/';
  const find = () => pages.allPages().find((p) => p.path === path);
  assert.equal(find().lastmod, '2026-01-15');
  assert.equal(quote.estimate('car-insurance', quote.DEFAULT_PROFILES.auto).asOf, 'January 2026');
  db.run("INSERT INTO seo_overrides(path, intro_md, updated_at) VALUES(?, 'x', '2026-05-01 10:00:00')", [path]);
  pages.invalidate();
  assert.equal(find().lastmod, '2026-05-01');
  db.run('DELETE FROM seo_overrides WHERE path = ?', [path]);
  settings.set('estimates_reviewed_at', before);
  pages.invalidate();
});

test('example estimate tables: every geo product has ordered, labelled rows', () => {
  const pages = require('../src/lib/pages');
  const prov = pages.province('on');
  const city = pages.city('on', 'toronto');
  for (const p of products.filter((x) => x.geo !== 'none')) {
    const t = pages.exampleTable(p, prov, p.geo === 'city' ? city : null);
    assert.ok(t && t.rows.length >= 3, `${p.slug} has rows`);
    assert.ok(t.assumptions && t.asOf, `${p.slug} states assumptions and date`);
    for (const r of t.rows) for (const c of r.slice(1)) assert.ok(c.low > 0 && c.low <= c.mid && c.mid <= c.high, `${p.slug} ${r[0]} ordered`);
  }
});

test('services: unique slugs and paths, valid parents, complete content, SEO-length meta', () => {
  const { services } = require('../src/data/services');
  const { bySlug } = require('../src/data/products');
  const provinceSlugs = new Set(geo.provinces.map((p) => p.slug));
  const codes = new Set(geo.provinces.map((p) => p.code));
  const seen = new Set();
  for (const s of services) {
    assert.ok(!seen.has(s.slug) && !seen.has(s.path), `${s.slug} unique`); seen.add(s.slug); seen.add(s.path);
    assert.ok(!bySlug[s.slug], `${s.slug} does not shadow a product`);
    assert.match(s.path, /^\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)?$/, `${s.slug} path shape`);
    const seg = s.path.split('/').filter(Boolean);
    assert.ok(seg.length === 1 ? !bySlug[seg[0]] : !provinceSlugs.has(seg[1]), `${s.path} does not collide with product or province URLs`);
    assert.ok(bySlug[s.parent], `${s.slug} parent ${s.parent}`);
    assert.ok(s.title.length <= 65, `${s.slug} title ${s.title.length}`);
    assert.ok(s.description.length >= 100 && s.description.length <= 160, `${s.slug} description ${s.description.length}`);
    assert.ok(s.intro.length && s.whoFor.length >= 3 && s.covers.length >= 2 && s.watch.length >= 2 && s.factors.length >= 3, `${s.slug} content`);
    assert.ok(s.faq.length >= 2 && s.faq.every((f) => f.q.endsWith('?') && f.a.length > 40), `${s.slug} FAQ`);
    for (const r of s.related) assert.ok(bySlug[r] || services.some((x) => x.slug === r), `${s.slug} related ${r}`);
    if (s.niche) assert.ok(s.desk && s.deskPitch && s.deskPitch.length > 60, `${s.slug} desk`);
    if (s.provinces) assert.ok(s.provinces.every((c) => codes.has(c)), `${s.slug} provinces`);
    if (s.estimate) assert.ok(quote.DEFAULT_PROFILES[bySlug[s.parent].quoteFlow] !== undefined, `${s.slug} estimate engine`);
  }
});

test('specialist desks: every niche service or product has a desk and the sample advisors staff real desks', () => {
  const specialties = require('../src/lib/specialties');
  const db = require('../src/db');
  assert.ok(specialties.DESKS.length >= 10);
  for (const d of specialties.DESKS) {
    assert.ok(d.desk.endsWith('desk'), d.slug);
    assert.ok(products.some((p) => p.slug === d.product), `${d.slug} product`);
  }
  assert.equal(specialties.isService('high-risk-car-insurance'), true);
  assert.equal(specialties.isService('not-a-desk'), false);
  assert.equal(specialties.productFor('cottage-seasonal-insurance'), 'home-insurance');
  for (const a of db.all('SELECT name, specialties FROM advisors')) {
    for (const s of JSON.parse(a.specialties || '[]')) assert.ok(specialties.deskBySlug[s], `${a.name} staffs unknown desk ${s}`);
  }
});

test('customer service phone: the placeholder is recognised and real numbers are not', () => {
  const settings = require('../src/lib/settings');
  assert.equal(settings.phoneIsPlaceholder(settings.PLACEHOLDER_PHONE), true);
  assert.equal(settings.phoneIsPlaceholder('1-800-000-0000'), true);
  assert.equal(settings.phoneIsPlaceholder(''), true);
  assert.equal(settings.phoneIsPlaceholder('1-888-412-7788'), false);
  assert.equal(settings.phoneIsPlaceholder('(416) 555-0199'), false);
});

test('markdown: TOC entries hold plain text (no double-escaped apostrophes or ampersands)', () => {
  const r = md.render("## Michael's take\n\nText.\n\n## Home & auto: what's covered?\n\nMore.");
  assert.deepEqual(r.toc.map((t) => t.text), ["Michael's take", "Home & auto: what's covered?"]);
  assert.ok(!r.toc.some((t) => /&#|&amp;/.test(t.text)));
});
