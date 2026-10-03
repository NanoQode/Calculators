'use strict';
/**
 * Page registry + programmatic content.
 *  - enabledProducts(): catalog filtered by Admin → Products toggles
 *  - allPages(): every public URL with lastmod/priority/indexable — feeds sitemaps, llms.txt, HTML sitemap
 *  - geoContent(): unique local content for /{product}/{province}/[{city}/] pages
 *  - indexability rules keep thin programmatic pages out of the index until enriched.
 */
const db = require('../db');
const settings = require('./settings');
const quoteEngine = require('./quote-engine');
const { products, bySlug } = require('../data/products');
const servicesData = require('../data/services');
const geo = require('../data/geo');
const { money } = require('./util');

let overridesCache = null;
function productOverrides() {
  if (!overridesCache) {
    overridesCache = Object.fromEntries(db.all('SELECT * FROM product_overrides').map((r) => [r.slug, r]));
    for (const [slug, o] of Object.entries(overridesCache)) if (o.lead_value && bySlug[slug]) bySlug[slug].leadValue = o.lead_value;
  }
  return overridesCache;
}
function invalidate() { overridesCache = null; geoOvCache = null; ovDates = null; }

function isEnabled(slug) { const o = productOverrides()[slug]; return !o || !!o.enabled; }
function enabledProducts() { return products.filter((p) => isEnabled(p.slug)); }
function getProduct(slug) { return isEnabled(slug) ? bySlug[slug] : null; }

let geoOvCache = null;
function geoOverride(key) {
  if (!geoOvCache) geoOvCache = Object.fromEntries(db.all('SELECT * FROM geo_overrides').map((r) => [r.key, { ...r, data: db.json(r.data, {}) }]));
  return geoOvCache[key] || null;
}
/** Province/city record with admin overrides merged in. */
function province(code) {
  const p = geo.provinceByCode[code];
  if (!p) return null;
  const ov = geoOverride(code);
  return ov ? { ...p, ...ov.data, verified_at: ov.verified_at } : p;
}
function city(provCode, slug) {
  const c = geo.cityByKey[`${provCode}/${slug}`];
  if (!c) return null;
  const ov = geoOverride(`${provCode}/${slug}`);
  return ov ? { ...c, ...ov.data, verified_at: ov.verified_at } : c;
}

/** Regulator name for running text: names stand alone (FSRA, AMF, Service NL), superintendents take "the". */
const regulatorName = (prov) => (/Superintendent/.test(prov.regulator.short) ? `the ${prov.regulator.short}` : prov.regulator.short);

/** Lower-case a phrase's first letter for mid-sentence use, keeping proper nouns and acronyms (FSRA, GTA) intact. */
const lcFirst = (t) => (/^[A-Z][A-Z]/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

const P_AND_C_CITY_TIER2 = new Set(['car-insurance', 'home-insurance', 'tenant-insurance', 'condo-insurance']);

function geoPath(product, prov, c) {
  return `/${product.slug}/${prov.slug}/${c ? c.slug + '/' : ''}`;
}

/** Should this programmatic page be indexed? Admin robots override always wins (handled in seo.meta). */
function geoIndexable(product, prov, c) {
  const path = geoPath(product, prov, c);
  const ov = db.get('SELECT intro_md, robots FROM seo_overrides WHERE path = ?', [path]);
  if (ov && ov.robots) return !/noindex/.test(ov.robots);
  if (ov && ov.intro_md && ov.intro_md.length > 300) return true; // enriched by an editor
  if (!c) return !prov.territory || product.category !== 'auto';
  if (product.geo !== 'city') return false;
  if (c.tier === 1) return true;
  if (c.tier === 2 && P_AND_C_CITY_TIER2.has(product.slug)) return true;
  return false;
}

function cityHubIndexable(c) { return c.tier <= 2; }

// ───────────────────────── Local content ─────────────────────────
function localFaq(product, prov, c) {
  const where = c ? c.name : prov.name;
  const faqs = [];
  const est = quoteEngine.estimate(product.slug, { ...quoteEngine.DEFAULT_PROFILES[product.quoteFlow], province: prov.code, city: c && c.slug });
  const fmt = (n) => money(n, { cents: n < 100 });
  faqs.push({
    q: `How much does ${product.name.toLowerCase()} cost in ${where}?`,
    a: `For an example profile (${est.example}), Instasure’s model estimates roughly ${fmt(est.low)}–${fmt(est.high)}${est.periodLabel} as of ${est.asOf}. Your price depends on ${product.factors.slice(0, 3).map(lcFirst).join(', ')} and the insurer — get an instant personalised estimate, then a licensed advisor confirms real insurer quotes.`,
  });
  if (product.category === 'auto') {
    if (prov.auto.system === 'public') faqs.push({ q: `Can I shop around for car insurance in ${prov.name}?`, a: `${prov.autoNotes[0]} ${prov.code === 'mb' ? 'Extension coverage is also largely provided through MPI, so savings usually come from discounts and from shopping home, tenant and life insurance.' : 'You can compare optional coverage from private insurers, which is where most savings are.'}` });
    else if (prov.auto.system === 'hybrid') faqs.push({ q: 'Do I need private car insurance in Quebec if the SAAQ covers injuries?', a: `Yes. ${prov.autoNotes[1]}` });
    else faqs.push({ q: `Is car insurance mandatory in ${prov.name}?`, a: `Yes. Every vehicle in ${prov.name} must carry insurance${prov.auto.minLiability ? `, including at least ${money(prov.auto.minLiability)} of third-party liability` : ''}. Most drivers carry $1–2 million of liability.` });
    if (prov.code === 'on') faqs.push({ q: 'What changed in Ontario auto insurance on July 1, 2026?', a: prov.autoNotes[1] });
    if (prov.code === 'ab') faqs.push({ q: 'Will Alberta car insurance change in 2027?', a: prov.autoNotes[1] });
  }
  if (product.category === 'property') {
    const risks = (c ? c.risks : prov.risks).slice(0, 3).join('; ');
    faqs.push({ q: `What are the biggest ${product.short.toLowerCase()} insurance risks in ${where}?`, a: `Local claim drivers include: ${risks}. Ask your advisor which endorsements (for example sewer backup, overland water${prov.code === 'bc' ? ', earthquake' : ''}) are available at your address.` });
  }
  if (product.category === 'life' || product.category === 'health') {
    faqs.push({ q: `Is my ${product.short.toLowerCase()} policy valid if I move out of ${prov.name}?`, a: 'Yes. Individual life, critical illness and disability policies stay in force if you move within Canada — just update your address with the insurer. Health and dental plans may re-price by province.' });
  }
  if (product.slug === 'super-visa-insurance') {
    faqs.push({ q: `Can I buy Super Visa insurance for my parents if I live in ${where}?`, a: `Yes. The policy covers your parent or grandparent while they visit you in ${where}. It must meet IRCC’s requirements (including at least $100,000 of emergency coverage for one year); a licensed advisor in ${prov.name} can help you compare plans and payment options.` });
  }
  faqs.push({ q: `Who regulates insurance in ${prov.name}?`, a: `${prov.regulator.name}. ${prov.licensing} Complaints about insurers can be escalated to the General Insurance OmbudService (home, auto, business) or the OmbudService for Life & Health Insurance.` });
  return faqs;
}

function geoContent(product, prov, c) {
  const where = c ? `${c.name}, ${prov.abbr}` : prov.name;
  const estimate = quoteEngine.estimate(product.slug, { ...quoteEngine.DEFAULT_PROFILES[product.quoteFlow], province: prov.code, city: c && c.slug });
  const facts = [];
  facts.push({ icon: 'gavel', label: 'Regulator', value: prov.regulator.short, url: prov.regulator.url });
  if (product.category === 'auto') {
    facts.push({ icon: 'directions_car', label: 'Auto system', value: prov.auto.label });
    if (prov.auto.minLiability) facts.push({ icon: 'shield', label: 'Minimum liability', value: money(prov.auto.minLiability) });
    if (prov.benchmarks.autoAnnual) facts.push({ icon: 'query_stats', label: c ? 'Provincial average (reference)' : 'Average premium (reference)', value: `${money(prov.benchmarks.autoAnnual)}/yr`, note: prov.benchmarks.autoSource || 'Instasure model' });
  }
  if (c) facts.push({ icon: 'groups', label: 'Population', value: `~${new Intl.NumberFormat('en-CA', { notation: 'compact' }).format(c.pop)}` });
  if (!c) facts.push({ icon: 'location_city', label: 'Cities covered', value: String((geo.citiesByProv[prov.code] || []).length) });

  // Local claim risks (theft, flooding, hail) drive P&C prices; life, health and travel are priced on the person, not the postal code.
  const localPricing = ['auto', 'property', 'business'].includes(product.category);
  const intro = [];
  if (product.category === 'auto') intro.push(prov.autoNotes[0]);
  if (localPricing && c) intro.push(`Pricing in ${c.name} reflects local claim patterns — ${c.risks.slice(0, 2).map(lcFirst).join(' and ')}.`);
  else if (localPricing) intro.push(`Key ${prov.name} risks insurers price in: ${prov.risks.slice(0, 3).map(lcFirst).join('; ')}.`);
  else {
    const f = product.factors.slice(0, 3).map(lcFirst);
    const factors = `${f.slice(0, -1).join(', ')}, and ${f[f.length - 1]}`;
    intro.push(c
      ? `${product.name} in ${c.name} is priced the same way as anywhere in ${prov.name}. Insurers look at ${factors}, not your postal code.`
      : `${product.name} in ${prov.name} is regulated by ${regulatorName(prov)}. Insurers price it on ${factors}, not your postal code; what differs by province is the rules and the advisors licensed to help you.`);
  }

  const mortgageRelated = ['life', 'property'].includes(product.category);
  const notes = product.category === 'auto'
    ? prov.autoNotes.slice(1)
    : (prov.events2026 || []).filter((e) => (/mortgage/i.test(e) ? mortgageRelated : true));
  const risks = !localPricing ? [] : c ? [...c.risks, ...prov.risks.slice(0, 2)] : prov.risks;
  const nearby = c ? (c.near || []).map((s) => geo.cityByKey[`${prov.code}/${s}`] || geo.cities.find((x) => x.slug === s)).filter(Boolean) : (geo.citiesByProv[prov.code] || []);
  return { where, estimate, facts, intro, notes, risks, faq: localFaq(product, prov, c), nearby, examples: exampleTable(product, prov, c) };
}

/**
 * Example estimates for a place: the priced table competitors publish (age × sex for life, driver profiles for
 * car, coverage levels for property), built from the same model as the widget and labelled as estimates.
 */
function exampleTable(product, prov, c) {
  const flow = product.quoteFlow;
  const base = { ...quoteEngine.DEFAULT_PROFILES[flow], province: prov.code, city: c ? c.slug : undefined };
  const est = (o) => quoteEngine.estimate(product.slug, { ...base, ...o });
  const cell = (e) => ({ mid: e.mid, low: e.low, high: e.high, period: e.periodLabel });
  const by = (label, list) => ({ cols: [label, 'Typical', 'Range'], rows: list.map(([name, o]) => { const e = est(o); return [name, cell(e)]; }), ranged: true });
  let t;
  if (flow === 'life') {
    const what = product.slug === 'whole-life-insurance' ? `${money(base.coverage)} whole life` : `${money(base.coverage)}, ${base.term}-year term`;
    t = { cols: ['Age', 'Female, non-smoker', 'Male, non-smoker'], rows: [25, 35, 45, 55, 65].map((age) => [String(age), cell(est({ age, sex: 'female', smoker: 'no' })), cell(est({ age, sex: 'male', smoker: 'no' }))]), assumptions: what };
  } else if (flow === 'health' && product.slug === 'health-dental-insurance') {
    t = { cols: ['Plan type', 'Age 35', 'Age 55'], rows: [['Single', 'single'], ['Couple', 'couple'], ['Family', 'family']].map(([name, household]) => [name, cell(est({ household, age: 35 })), cell(est({ household, age: 55 }))]), assumptions: 'mid-tier plan' };
  } else if (flow === 'health') {
    const what = product.slug === 'disability-insurance' ? `${money(base.income)} income, 90-day waiting period` : `${money(base.coverage)} critical illness coverage, 10-year term`;
    t = { cols: ['Age', 'Female, non-smoker', 'Male, non-smoker'], rows: [25, 35, 45, 55].map((age) => [String(age), cell(est({ age, sex: 'female', smoker: 'no' })), cell(est({ age, sex: 'male', smoker: 'no' }))]), assumptions: what };
  } else if (flow === 'auto') {
    t = by('Driver profile', [['Age 20, licensed 2 years', { age: 20, years_licensed: 2 }], ['Age 25, licensed 7 years', { age: 25, years_licensed: 7 }], ['Age 40, licensed 15+ years', { age: 40, years_licensed: 15 }], ['Age 40, one at-fault claim', { age: 40, years_licensed: 15, claims: 1 }], ['Age 40, one minor ticket', { age: 40, years_licensed: 15, tickets: 1 }], ['Age 65, licensed 15+ years', { age: 65, years_licensed: 15 }]]);
    t.assumptions = 'standard vehicle, full coverage';
  } else if (flow === 'property') {
    const list = product.slug === 'home-insurance' ? [['$350,000 rebuild cost', { rebuild: 350000 }], ['$500,000 rebuild cost', { rebuild: 500000 }], ['$750,000 rebuild cost', { rebuild: 750000 }], ['$1,000,000 rebuild cost', { rebuild: 1000000 }]]
      : product.slug === 'condo-insurance' ? [['$25,000 contents', { contents: 25000 }], ['$50,000 contents', { contents: 50000 }], ['$75,000 contents', { contents: 75000 }]]
        : [['$20,000 contents', { contents: 20000 }], ['$35,000 contents', { contents: 35000 }], ['$60,000 contents', { contents: 60000 }]];
    t = by('Coverage', list);
    t.assumptions = '$1,000 deductible, $2 million liability where applicable';
  } else if (flow === 'travel') {
    t = product.slug === 'super-visa-insurance'
      ? by('Visitor age', [55, 60, 65, 70, 75, 80].map((a) => [String(a), { visitor_age: a }]))
      : by('Traveller age', [30, 50, 65, 75].map((a) => [String(a), { age: a }]));
    t.assumptions = product.slug === 'super-visa-insurance' ? '$100,000 coverage, $0 deductible, 12 months, no pre-existing condition coverage' : '14-day trip, emergency medical';
  } else if (flow === 'business') {
    t = product.slug === 'group-benefits' ? by('Team size', [3, 10, 25, 50].map((n) => [`${n} employees`, { employees: n }]))
      : product.slug === 'contractor-insurance' ? by('Annual revenue', [100000, 250000, 500000].map((r) => [money(r), { industry: 'trades', revenue: r }]))
        : product.slug === 'professional-liability-insurance' ? by('Annual revenue', [75000, 150000, 300000].map((r) => [money(r), { industry: 'consulting', revenue: r }]))
          : by('Business type', ['consulting', 'retail', 'trades', 'food', 'ecommerce'].map((k) => [quoteEngine.INDUSTRY[k].label, { industry: k }]));
    t.assumptions = product.slug === 'group-benefits' ? 'standard plan design' : '$2 million CGL';
  }
  if (!t) return null;
  return { ...t, asOf: est({}).asOf };
}

// ───────────────────────── Specialty services ─────────────────────────
/** Services whose parent product is switched on (Admin → Products), in catalogue order. */
/** An advisor profile is indexed and marked up as a Person only when it is not a sample and has a licence on record. */
function advisorListed(a) { return !a.is_demo && db.json(a.licences, []).length > 0; }
function enabledServices() { return servicesData.services.filter((sv) => isEnabled(sv.parent)); }
function getService(slug) { const sv = servicesData.bySlug[slug]; return sv && isEnabled(sv.parent) ? sv : null; }
function serviceByPath(p) { const sv = servicesData.byPath[p]; return sv && isEnabled(sv.parent) ? sv : null; }
/** Services listed on a product pillar: those quoting through it. */
function servicesFor(productSlug) { return enabledServices().filter((sv) => sv.parent === productSlug); }
/** Example estimate for a service, from its parent product's model and the service's profile override. */
function serviceEstimate(sv, provCode = 'on') {
  if (!sv.estimate) return null;
  const parent = bySlug[sv.parent];
  const e = quoteEngine.estimate(sv.parent, { ...quoteEngine.DEFAULT_PROFILES[parent.quoteFlow], province: provCode, ...sv.estimate.profile });
  return { ...e, label: sv.estimate.label };
}
/** Services grouped by the parent product's category, for navigation and the services hub. */
function servicesByCategory() {
  const out = {};
  for (const sv of enabledServices()) (out[bySlug[sv.parent].category] ||= []).push(sv);
  return out;
}

let ovDates = null;
/**
 * Truthful "last updated" date for a programmatic page: the later of the model/data review date
 * (Admin → Site settings) and any editor override for this URL or place. Never "today" by default.
 */
function contentDate(path, geoKey) {
  if (!ovDates) ovDates = Object.fromEntries(db.all('SELECT path, updated_at FROM seo_overrides').map((r) => [r.path, String(r.updated_at || '').slice(0, 10)]));
  const dates = [String(settings.get('estimates_reviewed_at') || '').slice(0, 10), ovDates[path]];
  if (geoKey) { const g = geoOverride(geoKey); if (g) dates.push(String(g.updated_at || '').slice(0, 10)); }
  return dates.filter(Boolean).sort().pop();
}

// ───────────────────────── Registry ─────────────────────────
const STATIC = [
  ['/', 1.0, 'daily'], ['/quote/', 0.9, 'weekly'], ['/compare/', 0.7, 'weekly'], ['/guides/', 0.8, 'daily'],
  ['/calculators/', 0.8, 'monthly'], ['/insurance-services/', 0.8, 'weekly'], ['/calculators/life-insurance-needs/', 0.8, 'monthly'], ['/calculators/tenant-condo-coverage/', 0.6, 'monthly'],
  ['/calculators/business-coverage/', 0.6, 'monthly'], ['/calculators/mortgage-protection/', 0.6, 'monthly'],
  ['/advisors/', 0.7, 'weekly'], ['/insurance/', 0.7, 'monthly'], ['/glossary/', 0.5, 'monthly'],
  ['/about/', 0.4, 'yearly'], ['/how-we-make-money/', 0.4, 'yearly'], ['/editorial-guidelines/', 0.4, 'yearly'],
  ['/licensing/', 0.4, 'yearly'], ['/contact/', 0.4, 'yearly'], ['/privacy/', 0.2, 'yearly'], ['/terms/', 0.2, 'yearly'],
  ['/accessibility/', 0.2, 'yearly'], ['/site-map/', 0.3, 'weekly'],
];

function allPages() {
  const pages = [];
  const today = new Date().toISOString().slice(0, 10);
  const siteDate = contentDate('/') || today;
  const latestPost = String(db.value("SELECT MAX(updated_at) FROM posts WHERE status = 'published'") || '').slice(0, 10);
  const hubDate = [siteDate, latestPost].filter(Boolean).sort().pop();
  for (const [path, priority, changefreq] of STATIC) pages.push({ path, priority, changefreq, lastmod: ['/', '/guides/', '/site-map/'].includes(path) ? hubDate : contentDate(path) || siteDate, type: 'static', indexable: true });
  for (const p of enabledProducts()) {
    pages.push({ path: `/${p.slug}/`, priority: 0.9, changefreq: 'weekly', lastmod: contentDate(`/${p.slug}/`) || siteDate, type: 'product', indexable: true, title: p.name });
    if (p.geo === 'none') continue;
    for (const prov of geo.provinces) {
      const P = province(prov.code);
      pages.push({ path: geoPath(p, P), priority: 0.7, changefreq: 'monthly', lastmod: contentDate(geoPath(p, P), prov.code) || siteDate, type: 'product-province', indexable: geoIndexable(p, P), title: `${p.name} in ${P.name}` });
      if (p.geo !== 'city') continue;
      for (const c of geo.citiesByProv[prov.code]) {
        pages.push({ path: geoPath(p, P, c), priority: c.tier === 1 ? 0.7 : 0.5, changefreq: 'monthly', lastmod: contentDate(geoPath(p, P, c), `${prov.code}/${c.slug}`) || siteDate, type: 'product-city', indexable: geoIndexable(p, P, c), title: `${p.name} in ${c.name}, ${P.abbr}` });
      }
    }
  }
  for (const sv of enabledServices()) pages.push({ path: sv.path, priority: sv.niche ? 0.8 : 0.7, changefreq: 'monthly', lastmod: contentDate(sv.path) || siteDate, type: 'service', indexable: true, title: sv.name });
  // The Rate Index is noindex (and out of the sitemap) until at least one cell meets the minimum sample; it is recomputed from live data, so today is its true date.
  pages.push({ path: '/insights/rate-index/', priority: 0.7, changefreq: 'weekly', lastmod: today, type: 'static', indexable: rateIndexRows().length > 0, title: 'Instasure Rate Index' });
  for (const prov of geo.provinces) {
    pages.push({ path: `/insurance/${prov.slug}/`, priority: 0.6, changefreq: 'monthly', lastmod: contentDate(`/insurance/${prov.slug}/`, prov.code) || siteDate, type: 'geo-hub', indexable: true, title: `Insurance in ${prov.name}` });
    for (const c of geo.citiesByProv[prov.code]) pages.push({ path: `/insurance/${prov.slug}/${c.slug}/`, priority: 0.5, changefreq: 'monthly', lastmod: contentDate(`/insurance/${prov.slug}/${c.slug}/`, `${prov.code}/${c.slug}`) || siteDate, type: 'geo-hub', indexable: cityHubIndexable(c), title: `Insurance in ${c.name}` });
  }
  for (const post of db.all("SELECT slug, title, updated_at, published_at, robots FROM posts WHERE status = 'published' ORDER BY published_at DESC")) {
    pages.push({ path: `/guides/${post.slug}/`, priority: 0.7, changefreq: 'monthly', lastmod: String(post.updated_at || post.published_at).slice(0, 10), type: 'guide', indexable: !/noindex/.test(post.robots || ''), title: post.title });
  }
  for (const cat of db.all('SELECT slug, name FROM categories ORDER BY sort')) pages.push({ path: `/guides/category/${cat.slug}/`, priority: 0.5, changefreq: 'weekly', lastmod: hubDate, type: 'category', indexable: true, title: cat.name });
  // Only a real advisor with a licence on record is offered to search engines (see advisorListed).
  for (const a of db.all('SELECT slug, name, updated_at, is_demo, licences FROM advisors WHERE active = 1')) pages.push({ path: `/advisors/${a.slug}/`, priority: 0.5, changefreq: 'monthly', lastmod: String(a.updated_at).slice(0, 10), type: 'advisor', indexable: advisorListed(a), title: a.name });
  // Admin robots overrides apply to the sitemap too.
  const robotsOv = Object.fromEntries(db.all("SELECT path, robots FROM seo_overrides WHERE robots IS NOT NULL AND robots != ''").map((r) => [r.path, r.robots]));
  for (const pg of pages) if (robotsOv[pg.path]) pg.indexable = !/noindex/.test(robotsOv[pg.path]);
  return pages;
}

/** Rate Index cells: median estimate per product × province over 90 days, published only past a minimum sample. */
const RATE_INDEX_MIN = 25;
function rateIndexRows() {
  const raw = db.all(`SELECT product, province, json_extract(estimate,'$.mid') v, created_at
    FROM leads WHERE is_test = 0 AND lead_type IN ('quote','calculator') AND json_extract(estimate,'$.mid') IS NOT NULL
      AND province IS NOT NULL AND created_at >= datetime('now','-90 days')
    ORDER BY product, province, v`);
  const cells = new Map();
  for (const r of raw) {
    const key = `${r.product}|${r.province}`;
    if (!cells.has(key)) cells.set(key, { product: r.product, province: r.province, values: [], first: r.created_at, last: r.created_at });
    const c = cells.get(key);
    c.values.push(Number(r.v));
    if (r.created_at < c.first) c.first = r.created_at;
    if (r.created_at > c.last) c.last = r.created_at;
  }
  const out = [];
  for (const c of cells.values()) {
    const n = c.values.length;
    if (n < RATE_INDEX_MIN) continue;
    const m = Math.floor(n / 2);
    const mid = n % 2 ? c.values[m] : (c.values[m - 1] + c.values[m]) / 2; // values arrive sorted by v
    out.push({ product: c.product, province: c.province, n, mid, first: c.first, last: c.last });
  }
  return out;
}

function serviceable(code) { return (settings.get('serviceable_provinces') || []).includes(code); }

module.exports = { advisorListed, enabledServices, getService, serviceByPath, servicesFor, serviceEstimate, servicesByCategory, regulatorName, enabledProducts, getProduct, isEnabled, province, city, geoPath, geoIndexable, cityHubIndexable, geoContent, localFaq, exampleTable, contentDate, allPages, invalidate, serviceable, rateIndexRows, RATE_INDEX_MIN };
