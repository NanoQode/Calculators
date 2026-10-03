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
function invalidate() { overridesCache = null; geoOvCache = null; }

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
    a: `For an example profile (${est.example}), Instasure’s model estimates roughly ${fmt(est.low)}–${fmt(est.high)}${est.periodLabel} as of ${est.asOf}. Your price depends on ${product.factors.slice(0, 3).join(', ').toLowerCase()} and the insurer — get an instant personalised estimate, then a licensed advisor confirms real insurer quotes.`,
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

  const intro = [];
  if (product.category === 'auto') intro.push(prov.autoNotes[0]);
  if (c) intro.push(`Pricing in ${c.name} reflects local claim patterns — ${c.risks.slice(0, 2).join(' and ').toLowerCase()}.`);
  else intro.push(`Key ${prov.name} risks insurers price in: ${prov.risks.slice(0, 3).join('; ').toLowerCase()}.`);

  const notes = [...(product.category === 'auto' ? prov.autoNotes.slice(1) : []), ...(prov.events2026 || []).filter((e) => !/accident benefits|Care-First|rate cap|freeze/i.test(e) || product.category === 'auto')];
  const risks = c ? [...c.risks, ...prov.risks.slice(0, 2)] : prov.risks;
  const nearby = c ? (c.near || []).map((s) => geo.cityByKey[`${prov.code}/${s}`] || geo.cities.find((x) => x.slug === s)).filter(Boolean) : (geo.citiesByProv[prov.code] || []);
  return { where, estimate, facts, intro, notes, risks, faq: localFaq(product, prov, c), nearby };
}

// ───────────────────────── Registry ─────────────────────────
const STATIC = [
  ['/', 1.0, 'daily'], ['/quote/', 0.9, 'weekly'], ['/compare/', 0.7, 'weekly'], ['/guides/', 0.8, 'daily'],
  ['/calculators/', 0.8, 'monthly'], ['/calculators/life-insurance-needs/', 0.8, 'monthly'], ['/calculators/tenant-condo-coverage/', 0.6, 'monthly'],
  ['/calculators/business-coverage/', 0.6, 'monthly'], ['/calculators/mortgage-protection/', 0.6, 'monthly'],
  ['/advisors/', 0.7, 'weekly'], ['/insurance/', 0.7, 'monthly'], ['/glossary/', 0.5, 'monthly'],
  ['/about/', 0.4, 'yearly'], ['/how-we-make-money/', 0.4, 'yearly'], ['/editorial-guidelines/', 0.4, 'yearly'],
  ['/licensing/', 0.4, 'yearly'], ['/contact/', 0.4, 'yearly'], ['/privacy/', 0.2, 'yearly'], ['/terms/', 0.2, 'yearly'],
  ['/accessibility/', 0.2, 'yearly'], ['/site-map/', 0.3, 'weekly'],
];

function allPages() {
  const pages = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const [path, priority, changefreq] of STATIC) pages.push({ path, priority, changefreq, lastmod: today, type: 'static', indexable: true });
  for (const p of enabledProducts()) {
    pages.push({ path: `/${p.slug}/`, priority: 0.9, changefreq: 'weekly', lastmod: today, type: 'product', indexable: true, title: p.name });
    if (p.geo === 'none') continue;
    for (const prov of geo.provinces) {
      const P = province(prov.code);
      pages.push({ path: geoPath(p, P), priority: 0.7, changefreq: 'monthly', lastmod: today, type: 'product-province', indexable: geoIndexable(p, P), title: `${p.name} in ${P.name}` });
      if (p.geo !== 'city') continue;
      for (const c of geo.citiesByProv[prov.code]) {
        pages.push({ path: geoPath(p, P, c), priority: c.tier === 1 ? 0.7 : 0.5, changefreq: 'monthly', lastmod: today, type: 'product-city', indexable: geoIndexable(p, P, c), title: `${p.name} in ${c.name}, ${P.abbr}` });
      }
    }
  }
  for (const prov of geo.provinces) {
    pages.push({ path: `/insurance/${prov.slug}/`, priority: 0.6, changefreq: 'monthly', lastmod: today, type: 'geo-hub', indexable: true, title: `Insurance in ${prov.name}` });
    for (const c of geo.citiesByProv[prov.code]) pages.push({ path: `/insurance/${prov.slug}/${c.slug}/`, priority: 0.5, changefreq: 'monthly', lastmod: today, type: 'geo-hub', indexable: cityHubIndexable(c), title: `Insurance in ${c.name}` });
  }
  for (const post of db.all("SELECT slug, title, updated_at, published_at, robots FROM posts WHERE status = 'published' ORDER BY published_at DESC")) {
    pages.push({ path: `/guides/${post.slug}/`, priority: 0.7, changefreq: 'monthly', lastmod: String(post.updated_at || post.published_at).slice(0, 10), type: 'guide', indexable: !/noindex/.test(post.robots || ''), title: post.title });
  }
  for (const cat of db.all('SELECT slug, name FROM categories ORDER BY sort')) pages.push({ path: `/guides/category/${cat.slug}/`, priority: 0.5, changefreq: 'weekly', lastmod: today, type: 'category', indexable: true, title: cat.name });
  for (const a of db.all('SELECT slug, name, updated_at, is_demo FROM advisors WHERE active = 1')) pages.push({ path: `/advisors/${a.slug}/`, priority: 0.5, changefreq: 'monthly', lastmod: String(a.updated_at).slice(0, 10), type: 'advisor', indexable: !a.is_demo, title: a.name });
  // Admin robots overrides apply to the sitemap too.
  const robotsOv = Object.fromEntries(db.all("SELECT path, robots FROM seo_overrides WHERE robots IS NOT NULL AND robots != ''").map((r) => [r.path, r.robots]));
  for (const pg of pages) if (robotsOv[pg.path]) pg.indexable = !/noindex/.test(robotsOv[pg.path]);
  return pages;
}

function serviceable(code) { return (settings.get('serviceable_provinces') || []).includes(code); }

module.exports = { enabledProducts, getProduct, isEnabled, province, city, geoPath, geoIndexable, cityHubIndexable, geoContent, localFaq, allPages, invalidate, serviceable };
