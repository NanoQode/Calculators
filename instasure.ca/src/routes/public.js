'use strict';
/**
 * Public, server-rendered pages. Every page builds its own meta + JSON-LD via seo.meta() so the
 * full content, links and structured data are present in the initial HTML for search & AI crawlers.
 */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const config = require('../config');
const db = require('../db');
const settings = require('../lib/settings');
const seo = require('../lib/seo');
const pages = require('../lib/pages');
const routing = require('../lib/routing');
const quoteEngine = require('../lib/quote-engine');
const md = require('../lib/markdown');
const geo = require('../data/geo');
const { CATEGORIES } = require('../data/products');
const glossary = require('../data/glossary');
const specialties = require('../lib/specialties');
const U = require('../lib/util');

const router = express.Router();
const HOME = { name: 'Home', url: '/' };

router.use((req, res, next) => {
  res.locals.allProducts = pages.enabledProducts();
  next();
});

// ───────────────────────── helpers ─────────────────────────
function relatedGuides({ product, category, province, limit = 3, exclude } = {}) {
  const rows = db.all(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM posts p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 200`);
  const scored = rows.filter((r) => r.id !== exclude).map((r) => {
    const prods = db.json(r.products, []);
    const provs = db.json(r.provinces, []);
    let score = 0;
    if (product && prods.includes(product)) score += 5;
    if (category && prods.some((s) => (require('../data/products').bySlug[s] || {}).category === category)) score += 2;
    if (province && provs.includes(province)) score += 3;
    return { r, score };
  }).filter((x) => x.score > 0 || (!product && !category && !province));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.r);
}

function widgetFor(activeSlug, province) {
  const tabs = [
    { product: 'term-life-insurance', label: 'Term Life', flow: 'life' },
    { product: 'critical-illness-insurance', label: 'Critical Ill.', flow: 'health' },
    { product: 'tenant-insurance', label: 'Home & Tenant', flow: 'property' },
    { product: 'car-insurance', label: 'Car', flow: 'auto' },
    { product: 'business-insurance', label: 'Business', flow: 'business' },
  ].filter((t) => pages.isEnabled(t.product));
  const active = activeSlug && tabs.some((t) => t.product === activeSlug) ? activeSlug : (tabs[0] || {}).product;
  const flow = (tabs.find((t) => t.product === active) || {}).flow || 'life';
  const profile = quoteEngine.DEFAULT_PROFILES[flow];
  const estimate = quoteEngine.estimate(active, { ...profile, province: province || 'on' });
  return { tabs, active, estimate, flow, age: profile.age || 35 };
}

/** Single-product widget for product and product×geo pages. */
function widgetSingle(slug, province, citySlug) {
  const product = pages.getProduct(slug);
  const profile = quoteEngine.DEFAULT_PROFILES[product.quoteFlow];
  const estimate = quoteEngine.estimate(slug, { ...profile, province: province || 'on', city: citySlug });
  return { tabs: [{ product: slug, label: product.short, flow: product.quoteFlow }], active: slug, estimate, single: true, city: citySlug || '', flow: product.quoteFlow, age: profile.age || 35 };
}

function staticPage(slug) {
  const file = path.join(config.ROOT, 'src', 'content', 'pages', `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const front = m ? JSON.parse(m[1]) : {};
  const st = settings.all();
  const computed = {
    legal_entity: st.legal_name || st.site_name,
    address_line: st.mailing_address ? `Mailing address: ${st.mailing_address}.` : '',
    privacy_contact: st.privacy_officer || st.email,
  };
  const body = settings.interpolate((m ? m[2] : raw).replace(/\{(legal_entity|address_line|privacy_contact)\}/g, (x, k) => computed[k]));
  return { ...front, html: md.render(body).html };
}

const HOME_FAQ = [
  { q: 'Are Instasure estimates real quotes?', a: 'No — they are instant, indicative ranges for the example profile shown, built from typical Canadian pricing. They help you budget and compare options in seconds. A licensed advisor then gets actual insurer quotes based on your full details.' },
  { q: 'How does Instasure make money?', a: 'Insurers pay licensed advisors and brokerages a commission when a policy is placed. In Canada, that commission is built into the insurer’s filed or published rates, so using an advisor typically does not raise your premium. See [how we make money](/how-we-make-money/) for details.' },
  { q: 'Will I be spammed after getting an estimate?', a: 'No. Estimates don’t require an email. If you ask for a quote or a review, you’ll hear from one licensed advisor — and marketing emails only with your express consent. You can unsubscribe in one click at any time.' },
  { q: 'Which provinces do you serve?', a: 'Our guides and estimates cover all 10 provinces and 3 territories. Advisor service is available in the provinces where our partner advisors are licensed; if yours isn’t covered yet, you can join the waitlist.' },
  { q: 'Can I buy a policy instantly online?', a: 'For some products, insurers already offer fully digital applications with decisions in minutes, and your advisor can start one for you. Instant digital policies directly on Instasure are on our roadmap for eligible products.' },
];

// ───────────────────────── Home ─────────────────────────
router.get('/', (req, res) => {
  const productCards = pages.enabledProducts().filter((p) => !['term-life-insurance', 'whole-life-insurance', 'no-medical-life-insurance', 'contractor-insurance', 'professional-liability-insurance'].includes(p.slug))
    .map((p) => ({ ...p, from: quoteEngine.fromPrice(p.slug) }));
  const latestGuides = db.all(`SELECT p.*, c.name AS category_name FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 4`);
  res.page('public/home', {
    pageType: 'home', sectionLabel: 'Home',
    widget: widgetFor('term-life-insurance'), productCards, latestGuides, faq: HOME_FAQ,
    guideCount: db.value("SELECT COUNT(*) FROM posts WHERE status = 'published'"),
    asOf: U.monthYear(),
    meta: seo.meta({
      path: '/', noBrand: true,
      title: 'Instasure.ca — Compare Insurance Quotes in Canada | Instant Estimates',
      description: 'Instant insurance estimates for life, critical illness, home, tenant, car, travel and business coverage in every province — then a licensed advisor compares insurers for you.',
      jsonld: [seo.webPage({ path: '/', name: 'Instasure.ca', description: settings.get('tagline') }), seo.faqPage(HOME_FAQ, '/')],
    }),
  });
});

// ───────────────────────── Quote flow ─────────────────────────
router.get('/quote/', (req, res) => {
  const list = pages.enabledProducts();
  res.page('public/quote-start', {
    pageType: 'quote', sectionLabel: 'Get Quote', list,
    meta: seo.meta({
      path: '/quote/', title: 'Get an Instant Insurance Quote in Canada',
      description: 'Choose your coverage and get an instant premium estimate in about 60 seconds — life, critical illness, disability, home, tenant, condo, car, travel, Super Visa and business insurance.',
      breadcrumbs: [HOME, { name: 'Get a quote', url: '/quote/' }],
      jsonld: [seo.itemList(list.map((p) => ({ url: `/quote/${p.slug}/`, name: `${p.name} quote` })), '/quote/')],
    }),
  });
});

router.get('/quote/results/:ref/', (req, res, next) => {
  const lead = db.get('SELECT * FROM leads WHERE ref = ?', [String(req.params.ref).toUpperCase()]);
  if (!lead) return next();
  const product = require('../data/products').bySlug[lead.product];
  const estimate = db.json(lead.estimate, {});
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const prov = geo.provinceByCode[lead.province];
  res.page('public/quote-results', {
    pageType: 'results', sectionLabel: 'Your quotes', noCache: true, lead, product, estimate, advisor, prov,
    guides: relatedGuides({ product: lead.product, province: lead.province, limit: 3 }),
    meta: seo.meta({ path: req.path, title: 'Your instant estimate', description: 'Your Instasure estimate and next steps.', robots: 'noindex,nofollow' }),
  });
});

router.get('/quote/:product/', (req, res, next) => {
  const product = pages.getProduct(req.params.product);
  if (!product) return next();
  const q = req.query;
  const province = geo.provinceByCode[String(q.province || '').toLowerCase()] ? String(q.province).toLowerCase() : '';
  const prefill = {};
  for (const k of ['coverage', 'age', 'sex', 'term', 'smoker', 'city', 'industry', 'contents', 'rebuild', 'income', 'days', 'visitor_age', 'years_licensed', 'claims', 'tickets']) if (q[k]) prefill[k] = String(q[k]).slice(0, 40);
  const serviceSlug = specialties.isService(String(q.service || '')) && specialties.productFor(String(q.service)) === product.slug ? String(q.service) : null;
  const svData = serviceSlug ? pages.getService(serviceSlug) : null;
  const service = serviceSlug ? { slug: serviceSlug, name: specialties.labelFor(serviceSlug), desk: specialties.deskBySlug[serviceSlug] || null, plan: (svData && svData.plan) || null } : null;
  let resume = null;
  if (q.resume) {
    const lead = db.get("SELECT ref, first_name, email, province, city, quote_inputs FROM leads WHERE ref = ?", [String(q.resume).toUpperCase()]);
    if (lead) { resume = lead; Object.assign(prefill, db.json(lead.quote_inputs, {})); }
  }
  // Small permanent policies (funeral / final expense) price on their own plan, set by the service, never by the query or a resumed lead.
  if (service && service.plan) prefill.plan = service.plan; else delete prefill.plan;
  const initial = quoteEngine.estimate(product.slug, { ...quoteEngine.DEFAULT_PROFILES[product.quoteFlow], ...prefill, province: province || prefill.province || 'on' });
  const advisors = routing.forArea(province || 'on', product.category, 1);
  res.page('public/quote-flow', {
    pageType: 'quote', sectionLabel: 'Get Quote', product, prefill, province: province || prefill.province || '', initial, advisors, resume, service, noCache: !!q.resume,
    industries: quoteEngine.INDUSTRY,
    meta: seo.meta({
      path: `/quote/${product.slug}/`, title: `${product.name} Quote — Instant Estimate in 60 Seconds`,
      description: `Get an instant ${product.name.toLowerCase()} estimate for your province in about a minute, then compare real insurer quotes with a licensed advisor. No obligation.`,
      breadcrumbs: [HOME, { name: 'Get a quote', url: '/quote/' }, { name: product.name, url: `/quote/${product.slug}/` }],
      robots: Object.keys(q).length ? 'noindex,follow' : undefined,
    }),
  });
});

router.get('/thank-you/', (req, res) => {
  const lead = req.query.ref ? db.get('SELECT ref, first_name, status, advisor_id, lead_type FROM leads WHERE ref = ?', [String(req.query.ref).toUpperCase()]) : null;
  const advisor = lead && lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  res.page('public/thank-you', { noCache: true, lead, advisor, meta: seo.meta({ path: '/thank-you/', title: 'Thank you', description: 'We received your request.', robots: 'noindex,nofollow' }) });
});

// ───────────────────────── Compare ─────────────────────────
const COMPARE_TYPES = {
  life: { product: 'term-life-insurance', label: 'Life insurance', h: 'Compare life insurance options' },
  'critical-illness': { product: 'critical-illness-insurance', label: 'Critical illness', h: 'Compare critical illness plans' },
  car: { product: 'car-insurance', label: 'Car insurance', h: 'Compare car insurance coverage levels' },
  home: { product: 'home-insurance', label: 'Home insurance', h: 'Compare home insurance coverage' },
  tenant: { product: 'tenant-insurance', label: 'Tenant insurance', h: 'Compare tenant insurance coverage' },
  'super-visa': { product: 'super-visa-insurance', label: 'Super Visa', h: 'Compare Super Visa insurance plans' },
  business: { product: 'business-insurance', label: 'Business insurance', h: 'Compare small business insurance packages' },
};
router.get('/compare/', (req, res) => {
  const key = COMPARE_TYPES[req.query.type] ? req.query.type : 'life';
  const t = COMPARE_TYPES[key];
  const product = pages.getProduct(t.product) || pages.enabledProducts()[0];
  const estimate = quoteEngine.estimate(product.slug, { ...quoteEngine.DEFAULT_PROFILES[product.quoteFlow] });
  const advisors = routing.forArea('on', product.category, 1);
  res.page('public/compare', {
    pageType: 'compare', sectionLabel: 'Compare Plans', types: COMPARE_TYPES, typeKey: key, t, product, estimate, advisors,
    meta: seo.meta({
      path: '/compare/', canonical: '/compare/' + (key === 'life' ? '' : `?type=${key}`),
      title: `${t.h} in Canada (${new Date().getFullYear()})`,
      description: `Side-by-side comparison of ${t.label.toLowerCase()} options in Canada — price, underwriting speed, medical requirements and features — with instant estimates and licensed advice.`,
      breadcrumbs: [HOME, { name: 'Compare plans', url: '/compare/' }],
      robots: req.query.type && !COMPARE_TYPES[req.query.type] ? 'noindex,follow' : undefined,
    }),
  });
});

// ───────────────────────── Knowledge center ─────────────────────────
router.get('/guides/', (req, res) => {
  const cats = db.all('SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = \'published\') AS n FROM categories c ORDER BY sort');
  const guides = db.all(`SELECT p.id, p.slug, p.title, p.excerpt, p.reading_minutes, p.updated_at, p.published_at, p.featured_image, p.image_alt, p.content_type, p.takeaways,
    c.name AS category_name, c.slug AS category_slug, c.hub FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' ORDER BY p.published_at DESC`);
  const q = String(req.query.q || '').trim().slice(0, 80);
  const faq = [
    { q: 'Who writes Instasure’s guides?', a: 'Our editorial team researches each guide using regulator, government and insurer sources, and licensed advisors review guides in their area of expertise. Every guide shows its author, reviewer and last-updated date. See our [editorial guidelines](/editorial-guidelines/).' },
    { q: 'Are life insurance payouts taxable in Canada?', a: 'Death benefits paid to a named beneficiary are generally received tax-free. Corporate-owned policies and payouts to an estate can be treated differently — confirm with a tax professional.' },
    { q: 'What happens to my insurance if I move to another province?', a: 'Individual life, critical illness and disability policies stay in force across Canada. Home and auto policies must be rewritten for your new province, usually within a short window — tell your insurer before you move.' },
    { q: 'Does home insurance cover flooding?', a: 'Not automatically. Overland flood and sewer backup are usually optional endorsements, and availability depends on your address. Read [our water damage guide](/guides/does-home-insurance-cover-water-damage-canada/).' },
  ];
  res.page('public/guides', {
    pageType: 'guides', sectionLabel: 'Resources', cats, guides, q, faq,
    stats: { guides: guides.length, advisors: db.value('SELECT COUNT(*) FROM advisors WHERE active = 1'), provinces: geo.provinces.length },
    advisors: routing.forArea(null, null, 1),
    meta: seo.meta({
      path: '/guides/', title: 'Insurance Guides for Canadians — Knowledge & Risk Center',
      description: 'Plain-language Canadian insurance guides: life, critical illness, home, tenant, car, travel and business coverage — with calculators, province rules and licensed-advisor review.',
      breadcrumbs: [HOME, { name: 'Knowledge & guides', url: '/guides/' }],
      robots: q ? 'noindex,follow' : undefined,
      jsonld: [seo.webPage({ path: '/guides/', name: 'Insurance Knowledge & Risk Center', type: 'CollectionPage' }), seo.itemList(guides.slice(0, 30).map((g) => ({ url: `/guides/${g.slug}/`, name: g.title })), '/guides/'), seo.faqPage(faq, '/guides/')],
    }),
  });
});

router.get('/guides/category/:slug/', (req, res, next) => {
  const cat = db.get('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
  if (!cat) return next();
  const guides = db.all(`SELECT p.*, c.name AS category_name FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' AND p.category_id = ? ORDER BY p.published_at DESC`, [cat.id]);
  res.page('public/guide-category', {
    pageType: 'guides', sectionLabel: 'Resources', cat, guides,
    meta: seo.meta({
      path: req.path, title: `${cat.name} Guides for Canadians`, description: cat.description || `Canadian ${cat.name.toLowerCase()} guides from Instasure.`,
      breadcrumbs: [HOME, { name: 'Guides', url: '/guides/' }, { name: cat.name, url: req.path }],
      jsonld: [seo.webPage({ path: req.path, name: `${cat.name} guides`, type: 'CollectionPage' }), seo.itemList(guides.map((g) => ({ url: `/guides/${g.slug}/`, name: g.title })), req.path)],
    }),
  });
});

router.get('/guides/:slug/', (req, res, next) => {
  const post = db.get(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = ?`, [req.params.slug]);
  const preview = req.user && req.query.preview === '1';
  if (!post || (post.status !== 'published' && !preview)) return next();
  db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [post.id]);
  const author = post.author_id ? db.get('SELECT * FROM advisors WHERE id = ?', [post.author_id]) : null;
  const reviewer = post.reviewer_id ? db.get('SELECT * FROM advisors WHERE id = ?', [post.reviewer_id]) : null;
  const faq = db.json(post.faq, []);
  const prods = db.json(post.products, []).map((s) => pages.getProduct(s)).filter(Boolean);
  const path = `/guides/${post.slug}/`;
  const crumbs = [HOME, { name: 'Guides', url: '/guides/' }];
  if (post.category_slug) crumbs.push({ name: post.category_name, url: `/guides/category/${post.category_slug}/` });
  crumbs.push({ name: U.truncate(post.title, 48), url: path });
  res.page('public/guide', {
    pageType: 'guide', sectionLabel: 'Guide', post, author, reviewer, faq, prods, preview, noCache: preview,
    takeaways: db.json(post.takeaways, []), sources: db.json(post.sources, []), toc: db.json(post.toc, []),
    related: relatedGuides({ product: prods[0] && prods[0].slug, exclude: post.id, limit: 3 }),
    advisors: reviewer ? [reviewer] : routing.forArea(null, prods[0] && prods[0].category, 1),
    widget: prods[0] ? widgetSingle(prods[0].slug) : null,
    meta: seo.meta({
      path, title: post.seo_title || post.title, description: post.meta_description || post.excerpt, canonical: post.canonical || undefined,
      robots: preview ? 'noindex,nofollow' : post.robots || undefined, ogType: 'article', image: post.featured_image || undefined,
      published: U.isoDate(post.published_at), modified: U.isoDate(post.updated_at),
      breadcrumbs: crumbs,
      jsonld: [
        seo.webPage({ path, name: post.title, description: post.meta_description || post.excerpt, modified: post.last_reviewed_at || post.updated_at, reviewer }),
        seo.article(post, { author, reviewer, category: post.category_name ? { name: post.category_name } : null }),
        faq.length ? seo.faqPage(faq, path) : null,
        author ? seo.person(author) : null,
        reviewer && (!author || reviewer.id !== author.id) ? seo.person(reviewer) : null,
      ],
    }),
  });
});

// ───────────────────────── Calculators ─────────────────────────
const CALCS = {
  'life-insurance-needs': { title: 'Life Insurance Needs Calculator (Canada)', h1: 'How much life insurance do I need?', desc: 'Calculate how much life insurance your family needs using your income, mortgage, debts, childcare and education costs — built for Canadian households.', product: 'term-life-insurance', icon: 'calculate' },
  'mortgage-protection': { title: 'Mortgage Life Insurance vs Term Life Calculator', h1: 'Mortgage protection calculator: bank insurance vs term life', desc: 'Compare the cost and payout of bank mortgage creditor insurance against a personal term life policy for your mortgage balance and age.', product: 'mortgage-life-insurance', icon: 'house' },
  'tenant-condo-coverage': { title: 'Tenant & Condo Insurance Coverage Calculator', h1: 'How much tenant or condo insurance do I need?', desc: 'Estimate the replacement value of your belongings, condo improvements and the deductible-assessment coverage your building requires.', product: 'tenant-insurance', icon: 'apartment' },
  'business-coverage': { title: 'Small Business Insurance Coverage Checker', h1: 'What business insurance do I need?', desc: 'Answer a few questions about your business to see recommended CGL, E&O, property and cyber coverage plus an instant cost estimate.', product: 'business-insurance', icon: 'storefront' },
};
router.get('/calculators/', (req, res) => {
  res.page('public/calculators', {
    pageType: 'calculators', sectionLabel: 'Calculators', calcs: CALCS,
    meta: seo.meta({
      path: '/calculators/', title: 'Free Insurance Calculators for Canadians',
      description: 'Free Canadian insurance calculators: life insurance needs, mortgage protection vs term life, tenant & condo coverage and small-business coverage — instant results, no email required.',
      breadcrumbs: [HOME, { name: 'Calculators', url: '/calculators/' }],
      jsonld: [seo.itemList(Object.entries(CALCS).map(([k, c]) => ({ url: `/calculators/${k}/`, name: c.h1 })), '/calculators/')],
    }),
  });
});
router.get('/calculators/:slug/', (req, res, next) => {
  const c = CALCS[req.params.slug];
  if (!c) return next();
  const p = `/calculators/${req.params.slug}/`;
  const product = pages.getProduct(c.product);
  res.page(`public/calc-${req.params.slug}`, {
    pageType: 'calculator', sectionLabel: 'Calculators', calc: c, calcSlug: req.params.slug, product,
    guides: relatedGuides({ product: c.product, limit: 3 }), advisors: routing.forArea(null, product && product.category, 1),
    meta: seo.meta({
      path: p, title: c.title, description: c.desc,
      breadcrumbs: [HOME, { name: 'Calculators', url: '/calculators/' }, { name: c.h1, url: p }],
      jsonld: [seo.calculatorApp({ path: p, name: c.title, description: c.desc })],
    }),
  });
});

// ───────────────────────── Advisors ─────────────────────────
router.get('/advisors/', (req, res) => {
  const prov = geo.provinceByCode[String(req.query.province || '').toLowerCase()] ? String(req.query.province).toLowerCase() : '';
  const cat = CATEGORIES[req.query.category] ? req.query.category : '';
  const list = db.all('SELECT * FROM advisors WHERE active = 1 ORDER BY is_demo, years_experience DESC, name')
    .filter((a) => (!prov || db.json(a.provinces, []).includes(prov)) && (!cat || db.json(a.categories, []).includes(cat)));
  res.page('public/advisors', {
    pageType: 'advisors', sectionLabel: 'Advisors', list, prov, cat,
    meta: seo.meta({
      path: '/advisors/', title: 'Licensed Insurance Advisors Across Canada',
      description: 'Meet Instasure’s licensed insurance advisors. Every advisor is licensed in the provinces they serve and matched to you by province, product and language.',
      breadcrumbs: [HOME, { name: 'Advisors', url: '/advisors/' }],
      robots: prov || cat ? 'noindex,follow' : undefined,
      jsonld: [seo.itemList(list.filter((a) => pages.advisorListed(a)).map((a) => ({ url: `/advisors/${a.slug}/`, name: a.name })), '/advisors/')],
    }),
  });
});
router.get('/advisors/:slug/', (req, res, next) => {
  const a = db.get('SELECT * FROM advisors WHERE slug = ? AND active = 1', [req.params.slug]);
  if (!a) return next();
  const posts = db.all("SELECT slug, title, excerpt, updated_at FROM posts WHERE status = 'published' AND (author_id = ? OR reviewer_id = ?) ORDER BY published_at DESC LIMIT 12", [a.id, a.id]);
  const p = `/advisors/${a.slug}/`;
  res.page('public/advisor', {
    pageType: 'advisor', sectionLabel: 'Advisor', a, posts, licences: db.json(a.licences, []), languages: db.json(a.languages, []), provs: db.json(a.provinces, []), cats: db.json(a.categories, []),
    bio: md.render(a.bio_md || '').html,
    meta: seo.meta({
      path: p, title: `${a.name}${a.designations ? ', ' + a.designations : ''} — ${a.title || 'Licensed Insurance Advisor'}`,
      description: U.truncate(U.stripMd(a.bio_md) || `${a.name} is a licensed insurance advisor with ${settings.get('site_name')}.`, 160),
      ogType: 'profile', image: a.photo || undefined, robots: pages.advisorListed(a) ? undefined : 'noindex,follow',
      breadcrumbs: [HOME, { name: 'Advisors', url: '/advisors/' }, { name: a.name, url: p }],
      jsonld: [seo.webPage({ path: p, name: a.name, type: 'ProfilePage' }), ...(pages.advisorListed(a) ? [seo.person(a)] : [])],
    }),
  });
});

// ───────────────────────── Static / trust pages ─────────────────────────
const STATIC = {
  about: 'About Instasure.ca', 'how-we-make-money': 'How Instasure makes money', 'editorial-guidelines': 'Editorial guidelines',
  licensing: 'Licensing & disclosures', privacy: 'Privacy policy', terms: 'Terms of use', accessibility: 'Accessibility',
};
for (const slug of Object.keys(STATIC)) {
  router.get(`/${slug}/`, (req, res, next) => {
    const page = staticPage(slug);
    if (!page) return next();
    const p = `/${slug}/`;
    res.page('public/static', {
      pageType: 'static', sectionLabel: STATIC[slug], page, slug,
      advisorsCount: db.value('SELECT COUNT(*) FROM advisors WHERE active = 1 AND is_demo = 0'),
      meta: seo.meta({
        path: p, title: page.title || STATIC[slug], description: page.description,
        breadcrumbs: [HOME, { name: STATIC[slug], url: p }],
        jsonld: [seo.webPage({ path: p, name: page.title || STATIC[slug], description: page.description, type: slug === 'about' ? 'AboutPage' : 'WebPage', modified: page.updated })],
      }),
    });
  });
}

router.get('/contact/', (req, res) => {
  const serviceSlug = specialties.isService(String(req.query.service || '')) ? String(req.query.service) : null;
  const product = pages.getProduct(String(req.query.product || '')) || (serviceSlug && pages.getProduct(specialties.productFor(serviceSlug)));
  const service = serviceSlug ? { slug: serviceSlug, name: specialties.labelFor(serviceSlug), desk: specialties.deskBySlug[serviceSlug] || null } : null;
  res.page('public/contact', {
    pageType: 'contact', sectionLabel: 'Contact', product, service, type: req.query.type === 'consult' ? 'consult' : 'consult',
    meta: seo.meta({
      path: '/contact/', title: 'Contact Instasure — Book a Free Licensed Advisor Review',
      description: 'Book a free, no-obligation insurance review with an advisor licensed in your province, or send us a question.',
      breadcrumbs: [HOME, { name: 'Contact', url: '/contact/' }],
      robots: Object.keys(req.query).length ? 'noindex,follow' : undefined,
      jsonld: [seo.webPage({ path: '/contact/', name: 'Contact Instasure', type: 'ContactPage' })],
    }),
  });
});

router.get('/glossary/', (req, res) => {
  res.page('public/glossary', {
    pageType: 'glossary', sectionLabel: 'Glossary', terms: glossary,
    meta: seo.meta({
      path: '/glossary/', title: 'Canadian Insurance Glossary: Plain-Language Definitions',
      description: 'Plain-language definitions of Canadian insurance terms — from accident benefits and DCPD to riders, simplified issue and deductible assessments.',
      breadcrumbs: [HOME, { name: 'Glossary', url: '/glossary/' }],
      jsonld: [{ '@type': 'DefinedTermSet', '@id': seo.abs('/glossary/') + '#terms', name: 'Canadian insurance glossary', hasDefinedTerm: glossary.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.def, url: seo.abs(`/glossary/#${U.slugify(t.term)}`) })) }],
    }),
  });
});

router.get('/site-map/', (req, res) => {
  const all = pages.allPages().filter((p) => p.indexable);
  res.page('public/sitemap-html', {
    pageType: 'static', sectionLabel: 'Site map', groups: {
      'Main pages': all.filter((p) => ['static', 'product'].includes(p.type)),
      'Specialty coverage': all.filter((p) => p.type === 'service'),
      'Insurance by province & city': all.filter((p) => p.type === 'geo-hub'),
      'Coverage by province': all.filter((p) => p.type === 'product-province'),
      'Coverage by city': all.filter((p) => p.type === 'product-city'),
      Guides: all.filter((p) => ['guide', 'category'].includes(p.type)),
      Advisors: all.filter((p) => p.type === 'advisor'),
    },
    meta: seo.meta({ path: '/site-map/', title: 'Site map', description: 'Every guide, product, province and city page on Instasure.ca.', breadcrumbs: [HOME, { name: 'Site map', url: '/site-map/' }] }),
  });
});

// First-party data asset: aggregated estimate ranges from real quote requests (min sample size enforced).
router.get('/insights/rate-index/', (req, res) => {
  const MIN = pages.RATE_INDEX_MIN;
  const rows = pages.rateIndexRows().map((r) => ({ ...r, name: (pages.getProduct(r.product) || {}).name || r.product }));
  res.page('public/rate-index', {
    pageType: 'insights', sectionLabel: 'Rate index', rows, MIN,
    meta: seo.meta({
      path: '/insights/rate-index/', title: `Instasure Rate Index — Canadian Insurance Estimates (${U.monthYear()})`,
      description: 'Quarterly index of Canadian insurance estimate ranges by product and province, built from anonymised Instasure quote requests.',
      robots: rows.length ? undefined : 'noindex,follow',
      breadcrumbs: [HOME, { name: 'Rate index', url: '/insights/rate-index/' }],
      jsonld: rows.length ? [seo.dataset({ path: '/insights/rate-index/', name: 'Instasure Rate Index', description: 'Median modelled monthly premium estimates by product and province from anonymised quote requests (last 90 days).', modified: new Date(), variables: ['product', 'province', 'sample size', 'median monthly estimate (CAD)'], temporal: 'P90D' })] : [],
    }),
  });
});

// ───────────────────────── Geo hubs ─────────────────────────
router.get('/insurance/', (req, res) => {
  res.page('public/provinces', {
    pageType: 'geo', sectionLabel: 'By province',
    meta: seo.meta({
      path: '/insurance/', title: 'Insurance in Canada by Province & Territory',
      description: 'How insurance works in each Canadian province and territory — regulators, public vs private auto insurance, local risks and licensed advisors.',
      breadcrumbs: [HOME, { name: 'Insurance by province', url: '/insurance/' }],
      jsonld: [seo.itemList(geo.provinces.map((p) => ({ url: `/insurance/${p.slug}/`, name: `Insurance in ${p.name}` })), '/insurance/')],
    }),
  });
});

router.get('/insurance/:province/', (req, res, next) => {
  const base = geo.provinceBySlug[req.params.province];
  if (!base) return next();
  const prov = pages.province(base.code);
  const p = `/insurance/${prov.slug}/`;
  const faq = [
    { q: `Who regulates insurance in ${prov.name}?`, a: `${prov.regulator.name}. ${prov.licensing}` },
    { q: `How does car insurance work in ${prov.name}?`, a: prov.autoNotes.join(' ') },
    { q: `What are the biggest insurance risks in ${prov.name}?`, a: `${prov.risks.join('; ')}.` },
  ];
  res.page('public/geo-hub', {
    pageType: 'geo', sectionLabel: prov.name, prov, city: null, cities: geo.citiesByProv[prov.code], faq, serviceable: pages.serviceable(prov.code),
    advisors: routing.forArea(prov.code, null, 3), guides: relatedGuides({ province: prov.code, limit: 3 }),
    meta: seo.meta({
      path: p, title: `Insurance in ${prov.name}: Life, Home, Car & Business Coverage`,
      description: `How insurance works in ${prov.name}: ${prov.auto.label.toLowerCase()}, regulator (${prov.regulator.short}), local risks and licensed advisors. Get instant estimates for every type of coverage.`,
      breadcrumbs: [HOME, { name: 'Insurance by province', url: '/insurance/' }, { name: prov.name, url: p }],
      jsonld: [seo.webPage({ path: p, name: `Insurance in ${prov.name}`, about: seo.areaFor(prov), modified: pages.contentDate(p, prov.code) }), seo.faqPage(faq, p)],
    }),
  });
});

router.get('/insurance/:province/:city/', (req, res, next) => {
  const base = geo.provinceBySlug[req.params.province];
  if (!base) return next();
  const prov = pages.province(base.code);
  const c = pages.city(prov.code, req.params.city);
  if (!c) return next();
  const p = `/insurance/${prov.slug}/${c.slug}/`;
  const faq = [
    { q: `How do I find an insurance advisor in ${c.name}?`, a: `Start an instant estimate on Instasure and we’ll match you with an advisor licensed in ${prov.name} for your product and language. Advisors compare multiple insurers and there’s no cost to you.` },
    { q: `What insurance risks are common in ${c.name}?`, a: `${c.risks.join('; ')}.` },
    { q: `Who regulates insurance in ${c.name}?`, a: `${prov.regulator.name}. ${prov.licensing}` },
  ];
  res.page('public/geo-hub', {
    pageType: 'geo', sectionLabel: c.name, prov, city: c, cities: (c.near || []).map((s) => geo.cityByKey[`${prov.code}/${s}`] || geo.cities.find((x) => x.slug === s)).filter(Boolean), faq, serviceable: pages.serviceable(prov.code),
    advisors: routing.forArea(prov.code, null, 3), guides: relatedGuides({ province: prov.code, limit: 3 }),
    meta: seo.meta({
      path: p, title: `Insurance in ${c.name}, ${prov.abbr}: Compare Quotes & Licensed Advisors`,
      description: `Insurance in ${c.name}: instant estimates for car, home, tenant, life and business coverage, local risk factors, and advisors licensed in ${prov.name}.`,
      robots: pages.cityHubIndexable(c) ? undefined : 'noindex,follow',
      breadcrumbs: [HOME, { name: 'Insurance by province', url: '/insurance/' }, { name: prov.name, url: `/insurance/${prov.slug}/` }, { name: c.name, url: p }],
      jsonld: [seo.webPage({ path: p, name: `Insurance in ${c.name}`, about: seo.areaFor(prov, c), modified: pages.contentDate(p, `${prov.code}/${c.slug}`) }), seo.faqPage(faq, p)],
    }),
  });
});

// ───────────────────────── Product hubs & programmatic geo pages ─────────────────────────
// ───────────────────────── Specialty services ─────────────────────────
router.get('/insurance-services/', (req, res) => {
  const groups = pages.servicesByCategory();
  const prods = pages.enabledProducts();
  const deskList = specialties.DESKS.filter((d) => (d.kind === 'service' ? pages.getService(d.slug) : pages.getProduct(d.slug)));
  const all = pages.enabledServices();
  res.page('public/services', {
    pageType: 'services', sectionLabel: 'All services', groups, prods, deskList,
    meta: seo.meta({
      path: '/insurance-services/', title: 'All Insurance Services & Specialist Desks in Canada',
      description: 'Every type of insurance Instasure covers, from car, home and life to pet, boat, landlord and commercial auto, plus specialist desks for hard-to-place needs.',
      breadcrumbs: [HOME, { name: 'All services', url: '/insurance-services/' }],
      jsonld: [seo.webPage({ path: '/insurance-services/', name: 'All insurance services', modified: pages.contentDate('/insurance-services/') }), seo.itemList([...prods.map((x) => ({ url: `/${x.slug}/`, name: x.name })), ...all.map((x) => ({ url: x.path, name: x.name }))], '/insurance-services/')],
    }),
  });
});

/** Quote link for a service: its parent product's flow, tagged with the service and pre-filled with its example profile. */
function serviceQuoteUrl(sv) {
  const qs = new URLSearchParams({ service: sv.slug });
  for (const [k, v] of Object.entries((sv.estimate && sv.estimate.profile) || {})) if (k !== 'plan') qs.set(k, String(v));
  return `/quote/${sv.parent}/?${qs}`;
}

// Service pages live at their own paths (top-level like /pet-insurance/ or nested like
// /car-insurance/high-risk-drivers/). Registered before the product routes, which they never collide with.
router.get(/^\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)?$/, (req, res, next) => {
  const sv = pages.serviceByPath(req.path);
  if (!sv) return next();
  const p = sv.path;
  const product = pages.getProduct(sv.parent);
  const ov = seo.getOverride(p) || {};
  const desk = specialties.deskBySlug[sv.slug] || null;
  const faq = [...sv.faq, ...(ov.faq || [])];
  const related = (sv.related || []).map((slug) => {
    const x = pages.getService(slug) || pages.getProduct(slug);
    return x && { name: x.name, icon: x.icon, url: x.path || `/${x.slug}/` };
  }).filter(Boolean);
  const nested = p.startsWith(`/${product.slug}/`);
  const crumbs = [HOME, nested ? { name: product.name, url: `/${product.slug}/` } : { name: 'All services', url: '/insurance-services/' }, { name: sv.name, url: p }];
  const updated = pages.contentDate(p);
  const estimate = pages.serviceEstimate(sv);
  // A price headline ("from $1 a day") shows only while the labelled example estimate supports it.
  const perDay = estimate && estimate.period === 'month' ? estimate.mid * 12 / 365 : null;
  const claimOk = !sv.claimDaily || (perDay !== null && perDay <= sv.claimDaily);
  res.page('public/service', {
    pageType: 'service', sectionLabel: sv.short, sv, product, desk, faq, related, updated,
    estimate, quoteUrl: serviceQuoteUrl(sv), priceClaim: sv.claimDaily && claimOk ? { perDay } : null,
    intro: ov.intro_md ? md.render(ov.intro_md).html : null, h1: ov.h1 || (claimOk && sv.h1) || sv.name,
    advisors: routing.forArea(null, product.category, 1, desk ? sv.slug : null),
    guides: relatedGuides({ product: product.slug, category: product.category, limit: 3 }),
    siblings: pages.servicesFor(product.slug).filter((x) => x.slug !== sv.slug).slice(0, 8),
    meta: seo.meta({
      path: p, title: claimOk ? sv.title : `${sv.name} in Canada`, description: sv.description, breadcrumbs: crumbs,
      jsonld: [seo.webPage({ path: p, name: sv.name, description: sv.description, modified: updated }), seo.financialProduct({ name: sv.name, tagline: sv.tagline }, { path: p }), seo.faqPage(faq, p)],
    }),
  });
});

router.get('/:product/', (req, res, next) => {
  const product = pages.getProduct(req.params.product);
  if (!product) return next();
  const p = `/${product.slug}/`;
  const ov = seo.getOverride(p) || {};
  const faq = [...product.faq, ...(ov.faq || [])];
  const topCities = product.geo === 'city' ? geo.cities.filter((c) => c.tier === 1).sort((a, b) => b.pop - a.pop).slice(0, 18) : [];
  const updated = pages.contentDate(p);
  res.page('public/product', {
    pageType: 'product', sectionLabel: product.short, product, faq, topCities, updated,
    services: pages.servicesFor(product.slug), desk: specialties.deskBySlug[product.slug] || null,
    from: quoteEngine.fromPrice(product.slug), widget: widgetSingle(product.slug),
    intro: ov.intro_md ? md.render(ov.intro_md).html : null, h1: ov.h1 || product.h1,
    related: product.related.map((s) => pages.getProduct(s)).filter(Boolean),
    guides: relatedGuides({ product: product.slug, category: product.category, limit: 3 }),
    advisors: routing.forArea(null, product.category, 1),
    meta: seo.meta({
      path: p, title: `${product.h1.split(':')[0]} (${new Date().getFullYear()})`,
      description: `${product.tagline} Instant ${product.name.toLowerCase()} estimates for every province, plain-language guidance and licensed advisors.`,
      breadcrumbs: [HOME, { name: product.name, url: p }],
      jsonld: [seo.webPage({ path: p, name: product.name, description: product.tagline, modified: updated }), seo.financialProduct(product, { path: p }), seo.faqPage(faq, p)],
    }),
  });
});

function renderGeo(req, res, next, product, prov, c) {
  const p = pages.geoPath(product, prov, c);
  const ov = seo.getOverride(p) || {};
  const content = pages.geoContent(product, prov, c);
  const faq = [...content.faq, ...(ov.faq || []), ...product.faq.slice(0, 2)];
  const where = c ? `${c.name}, ${prov.abbr}` : prov.name;
  const indexable = pages.geoIndexable(product, prov, c);
  const year = new Date().getFullYear();
  const crumbs = [HOME, { name: product.name, url: `/${product.slug}/` }, { name: prov.name, url: pages.geoPath(product, prov) }];
  if (c) crumbs.push({ name: c.name, url: p });
  const updated = pages.contentDate(p, c ? `${prov.code}/${c.slug}` : prov.code);
  const advice = pages.serviceable(prov.code) ? `advisors licensed in ${prov.name}` : `a waitlist for licensed advice in ${prov.name}`;
  res.page('public/product-geo', {
    pageType: 'product-geo', sectionLabel: `${product.short} · ${c ? c.name : prov.abbr}`, product, prov, city: c, content, faq, where, updated,
    serviceable: pages.serviceable(prov.code),
    intro: ov.intro_md ? md.render(ov.intro_md).html : null, h1: ov.h1 || `${product.name} in ${where}`,
    otherProducts: pages.enabledProducts().filter((x) => x.slug !== product.slug && x.geo === (c ? 'city' : x.geo) && (c ? x.geo === 'city' : x.geo !== 'none')).slice(0, 8),
    provCities: c ? [] : (geo.citiesByProv[prov.code] || []),
    widget: widgetSingle(product.slug, prov.code, c && c.slug), widgetProvince: prov.code,
    advisors: routing.forArea(prov.code, product.category, 3),
    guides: relatedGuides({ product: product.slug, province: prov.code, limit: 3 }),
    meta: seo.meta({
      path: p,
      title: c ? `${product.name} ${c.name}, ${prov.abbr}: Compare Quotes & Costs (${year})` : `${product.name} in ${prov.name}: Costs, Rules & Quotes (${year})`,
      description: c
        ? `Compare ${product.name.toLowerCase()} in ${where}: instant estimate (${U.money(content.estimate.low, { cents: content.estimate.low < 100 })}–${U.money(content.estimate.high, { cents: content.estimate.high < 100 })}${content.estimate.periodLabel} example), ${content.risks.length ? 'local risk factors' : `example prices by ${content.examples ? content.examples.cols[0].toLowerCase() : 'profile'}`} and ${advice}.`
        : `${product.name} in ${prov.name}: how it works under ${pages.regulatorName(prov)}, what drives price, instant estimates and ${advice}.`,
      robots: indexable ? undefined : 'noindex,follow',
      breadcrumbs: crumbs,
      jsonld: [seo.webPage({ path: p, name: `${product.name} in ${where}`, about: seo.areaFor(prov, c), modified: updated }), seo.financialProduct(product, { path: p, province: prov, city: c }), seo.faqPage(faq, p)],
    }),
  });
}

router.get('/:product/:province/', (req, res, next) => {
  const product = pages.getProduct(req.params.product);
  const base = geo.provinceBySlug[req.params.province];
  if (!product || !base || product.geo === 'none') return next();
  renderGeo(req, res, next, product, pages.province(base.code), null);
});

router.get('/:product/:province/:city/', (req, res, next) => {
  const product = pages.getProduct(req.params.product);
  const base = geo.provinceBySlug[req.params.province];
  if (!product || !base || product.geo !== 'city') return next();
  const c = pages.city(base.code, req.params.city);
  if (!c) return next();
  renderGeo(req, res, next, product, pages.province(base.code), c);
});

module.exports = router;
