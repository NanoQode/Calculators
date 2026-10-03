'use strict';
/**
 * SEO core: page meta (title/description/canonical/robots/OG), per-path admin overrides,
 * and schema.org JSON-LD graph builders tuned for YMYL/insurance (E-E-A-T):
 * InsuranceAgency org, WebSite, BreadcrumbList, FinancialProduct, Article with author + reviewedBy,
 * Person with licence credentials, FAQPage, WebApplication (calculators), Dataset (rate index).
 */
const config = require('../config');
const db = require('../db');
const settings = require('./settings');
const { truncate, isoDate } = require('./util');
const geo = require('../data/geo');

const abs = (p) => (!p ? undefined : /^https?:\/\//.test(p) ? p : config.siteUrl + (p.startsWith('/') ? p : '/' + p));
const ORG_ID = () => `${config.siteUrl}/#organization`;
const SITE_ID = () => `${config.siteUrl}/#website`;

const overrideCache = new Map();
function getOverride(path) {
  if (overrideCache.has(path)) return overrideCache.get(path);
  const row = db.get('SELECT * FROM seo_overrides WHERE path = ?', [path]) || null;
  if (row) row.faq = db.json(row.faq, []);
  overrideCache.set(path, row);
  return row;
}
function clearOverrides() { overrideCache.clear(); }

function brandTitle(title) {
  const brand = settings.get('site_name', 'Instasure.ca');
  if (!title) return brand;
  if (title.includes(brand)) return title;
  const full = `${title} | ${brand}`;
  return full.length <= 65 ? full : title;
}

/**
 * Build the meta object consumed by views/public/layout.ejs.
 * @param {object} o { path, title, description, robots, canonical, ogType, image, breadcrumbs, jsonld[], published, modified, noBrand }
 */
function meta(o) {
  const ov = getOverride(o.path) || {};
  const title = ov.title || o.title;
  const m = {
    path: o.path,
    title: o.noBrand ? title : brandTitle(title),
    rawTitle: title,
    description: truncate(ov.description || o.description || settings.get('tagline'), 165),
    canonical: abs(ov.canonical || o.canonical || o.path),
    robots: ov.robots || o.robots || 'index,follow,max-image-preview:large,max-snippet:-1',
    ogType: o.ogType || 'website',
    image: abs(ov.og_image || o.image || settings.get('default_og_image')),
    breadcrumbs: o.breadcrumbs || [],
    published: o.published, modified: o.modified,
    override: ov,
    alternates: o.alternates || [],
  };
  const graph = [organization(), website()];
  if (m.breadcrumbs.length) graph.push(breadcrumb(m.breadcrumbs));
  for (const node of o.jsonld || []) if (node) graph.push(node);
  if (ov.faq && ov.faq.length && !(o.jsonld || []).some((n) => n && n['@type'] === 'FAQPage')) graph.push(faqPage(ov.faq, o.path));
  if (ov.schema_json) { try { const extra = JSON.parse(ov.schema_json); graph.push(...(Array.isArray(extra) ? extra : [extra])); } catch { /* ignore bad admin JSON */ } }
  m.jsonld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  m.isNoindex = /noindex/.test(m.robots);
  return m;
}

// ───────────────────────── JSON-LD builders ─────────────────────────
function organization() {
  const s = settings.all();
  const served = (s.serviceable_provinces || []).map((c) => geo.provinceByCode[c]).filter(Boolean);
  const node = {
    '@type': 'InsuranceAgency',
    '@id': ORG_ID(),
    name: s.site_name,
    legalName: s.legal_name || undefined,
    url: config.siteUrl + '/',
    logo: { '@type': 'ImageObject', url: abs('/img/logo.svg') },
    image: abs('/img/logo.svg'),
    description: s.tagline,
    email: s.email || undefined,
    telephone: s.phone || undefined,
    foundingDate: s.founded_year || undefined,
    areaServed: served.length
      ? served.map((p) => ({ '@type': 'AdministrativeArea', name: p.name, containedInPlace: { '@type': 'Country', name: 'Canada' } }))
      : { '@type': 'Country', name: 'Canada' },
    knowsAbout: ['Life insurance', 'Critical illness insurance', 'Disability insurance', 'Car insurance', 'Home insurance', 'Tenant insurance', 'Business insurance', 'Super Visa insurance'],
    sameAs: (s.social_links || []).length ? s.social_links : undefined,
    publishingPrinciples: abs('/editorial-guidelines/'),
  };
  if (s.mailing_address) node.address = { '@type': 'PostalAddress', streetAddress: s.mailing_address, addressCountry: 'CA' };
  if (s.phone) node.contactPoint = { '@type': 'ContactPoint', telephone: s.phone, contactType: 'customer service', areaServed: 'CA', availableLanguage: ['English'] };
  return node;
}

function website() {
  return {
    '@type': 'WebSite', '@id': SITE_ID(), url: config.siteUrl + '/', name: settings.get('site_name'),
    inLanguage: 'en-CA', publisher: { '@id': ORG_ID() },
    potentialAction: { '@type': 'SearchAction', target: `${config.siteUrl}/guides/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
}

function breadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })),
  };
}

function webPage({ path, name, description, type = 'WebPage', modified, reviewer, about }) {
  return {
    '@type': type, '@id': abs(path) + '#webpage', url: abs(path), name, description,
    isPartOf: { '@id': SITE_ID() }, inLanguage: 'en-CA', dateModified: isoDate(modified),
    reviewedBy: reviewer ? personRef(reviewer) : undefined,
    lastReviewed: reviewer && modified ? isoDate(modified) : undefined,
    about,
  };
}

function faqPage(items, path) {
  if (!items || !items.length) return null;
  return {
    '@type': 'FAQPage', '@id': abs(path) + '#faq',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

function areaFor(province, city) {
  if (city && province) return { '@type': 'City', name: city.name, containedInPlace: { '@type': 'AdministrativeArea', name: province.name } };
  if (province) return { '@type': 'AdministrativeArea', name: province.name, containedInPlace: { '@type': 'Country', name: 'Canada' } };
  return { '@type': 'Country', name: 'Canada' };
}

function financialProduct(product, { path, province, city } = {}) {
  const where = city ? `${city.name}, ${province.abbr}` : province ? province.name : 'Canada';
  return {
    '@type': 'FinancialProduct', '@id': abs(path) + '#product',
    name: `${product.name} — ${where}`, category: 'Insurance', serviceType: product.name,
    description: product.tagline, url: abs(path),
    provider: { '@id': ORG_ID() }, areaServed: areaFor(province, city),
    audience: { '@type': 'Audience', geographicArea: areaFor(province, city) },
  };
}

function personRef(a) {
  return { '@type': 'Person', '@id': abs(`/advisors/${a.slug}/`) + '#person', name: a.name, url: abs(`/advisors/${a.slug}/`) };
}

function person(a) {
  const licences = Array.isArray(a.licences) ? a.licences : db.json(a.licences, []);
  return {
    ...personRef(a),
    jobTitle: a.title || 'Licensed Insurance Advisor',
    image: a.photo ? abs(a.photo) : undefined,
    description: truncate((a.bio_md || '').replace(/[#*_>]/g, ''), 240),
    worksFor: { '@id': ORG_ID() },
    knowsLanguage: (db.json(a.languages, ['en']) || []).map((l) => ({ en: 'English', fr: 'French', pa: 'Punjabi', hi: 'Hindi', zh: 'Chinese', tl: 'Tagalog', ar: 'Arabic', es: 'Spanish', ur: 'Urdu', ta: 'Tamil', gu: 'Gujarati' }[l] || l)),
    hasCredential: licences.map((l) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'license',
      name: `${l.type || 'Insurance licence'}${l.province ? ` (${String(l.province).toUpperCase()})` : ''}`,
      identifier: l.number || undefined,
      recognizedBy: l.regulator ? { '@type': 'Organization', name: l.regulator } : undefined,
    })),
    areaServed: (db.json(a.provinces, []) || []).map((c) => geo.provinceByCode[c]).filter(Boolean).map((p) => ({ '@type': 'AdministrativeArea', name: p.name })),
  };
}

function article(post, { author, reviewer, category } = {}) {
  const path = `/guides/${post.slug}/`;
  return {
    '@type': post.content_type === 'news' ? 'NewsArticle' : 'Article',
    '@id': abs(path) + '#article',
    headline: truncate(post.title, 110),
    description: post.meta_description || post.excerpt,
    image: post.featured_image ? [abs(post.featured_image)] : [abs(settings.get('default_og_image'))],
    datePublished: isoDate(post.published_at),
    dateModified: isoDate(post.updated_at || post.published_at),
    author: author ? personRef(author) : { '@type': 'Organization', name: `${settings.get('site_name')} Editorial Team`, url: abs('/editorial-guidelines/') },
    publisher: { '@id': ORG_ID() },
    mainEntityOfPage: { '@id': abs(path) + '#webpage' },
    articleSection: category ? category.name : undefined,
    keywords: [post.focus_keyword, ...(db.json(post.keywords, []) || [])].filter(Boolean).join(', ') || undefined,
    wordCount: post.word_count || undefined,
    inLanguage: 'en-CA',
    isAccessibleForFree: true,
    citation: (db.json(post.sources, []) || []).map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url })),
    ...(reviewer ? {} : {}),
  };
}

function calculatorApp({ path, name, description }) {
  return {
    '@type': 'WebApplication', '@id': abs(path) + '#app', name, description, url: abs(path),
    applicationCategory: 'FinanceApplication', operatingSystem: 'Any', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' }, provider: { '@id': ORG_ID() },
  };
}

function itemList(items, path) {
  return {
    '@type': 'ItemList', '@id': abs(path) + '#list',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(it.url), name: it.name })),
  };
}

function dataset({ path, name, description, modified, variables = [], temporal }) {
  return {
    '@type': 'Dataset', '@id': abs(path) + '#dataset', name, description, url: abs(path),
    creator: { '@id': ORG_ID() }, publisher: { '@id': ORG_ID() }, isAccessibleForFree: true,
    dateModified: isoDate(modified), temporalCoverage: temporal, spatialCoverage: { '@type': 'Country', name: 'Canada' },
    variableMeasured: variables, license: abs('/terms/'),
  };
}

module.exports = {
  abs, meta, brandTitle, getOverride, clearOverrides,
  organization, website, breadcrumb, webPage, faqPage, financialProduct, person, personRef, article, calculatorApp, itemList, dataset, areaFor,
};
