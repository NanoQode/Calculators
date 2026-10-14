'use strict';
/**
 * Crawler-facing documents: robots.txt (with an AI-bot policy switch), XML sitemaps
 * (index + per-type, accurate <lastmod>, only indexable URLs), llms.txt and llms-full.txt.
 */
const config = require('../config');
const db = require('../db');
const settings = require('./settings');
const pages = require('./pages');
const { escapeHtml, stripMd } = require('./util');
const { CATEGORIES } = require('../data/products');

const AI_TRAINING = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'meta-externalagent', 'cohere-training-data-crawler'];
const AI_SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'DuckAssistBot', 'Amazonbot', 'MistralAI-User'];
// Paths no crawler needs. A bot that matches its own User-agent group ignores the `*` group, so every group repeats these.
const PRIVATE = ['/admin/', '/api/', '/quote/results/', '/unsubscribe', '/e/'];

function robots() {
  const s = settings.all();
  const lines = [
    `# robots.txt for ${s.site_name}`,
    'User-agent: *',
    ...PRIVATE.map((x) => `Disallow: ${x}`),
    'Allow: /',
    '',
  ];
  const welcome = (ua) => lines.push(`User-agent: ${ua}`, 'Allow: /', ...PRIVATE.map((x) => `Disallow: ${x}`), '');
  const blocked = (ua) => lines.push(`User-agent: ${ua}`, 'Disallow: /', '');
  if (s.ai_bot_policy === 'block_all') {
    lines.push('# AI search / assistant crawlers');
    AI_SEARCH.forEach(blocked);
  } else {
    lines.push('# AI search & assistant crawlers are welcome (answer-engine visibility)');
    AI_SEARCH.forEach(welcome);
  }
  if (s.ai_bot_policy === 'search_only' || s.ai_bot_policy === 'block_all') {
    lines.push('# AI model-training crawlers');
    AI_TRAINING.forEach(blocked);
  } else {
    lines.push('# AI model-training crawlers are welcome too (policy: allow all)');
    AI_TRAINING.forEach(welcome);
  }
  if (s.robots_extra) lines.push(String(s.robots_extra), '');
  lines.push(`Sitemap: ${config.siteUrl}/sitemap.xml`);
  lines.push(`# LLM-readable index: ${config.siteUrl}/llms.txt`);
  return lines.join('\n') + '\n';
}

// One sitemap per page type, so Search Console reports indexing for each type separately.
const GROUPS = {
  core: (p) => ['static', 'product'].includes(p.type),
  services: (p) => p.type === 'service',
  provinces: (p) => p.type === 'product-province',
  cities: (p) => p.type === 'product-city',
  places: (p) => p.type === 'geo-hub',
  guides: (p) => ['guide', 'category'].includes(p.type),
  advisors: (p) => p.type === 'advisor',
};
// Earlier combined file, still served for anyone who submitted it, but no longer listed in the index.
const LEGACY = { geo: (p) => ['product-province', 'product-city', 'geo-hub'].includes(p.type) };

function urlset(list) {
  const body = list.map((p) => `  <url><loc>${escapeHtml(config.siteUrl + p.path)}</loc><lastmod>${p.lastmod}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function sitemapIndex() {
  const all = pages.allPages().filter((p) => p.indexable);
  const entries = Object.keys(GROUPS).map((g) => {
    const list = all.filter(GROUPS[g]);
    if (!list.length) return null; // an empty sitemap is an error in Search Console
    const last = list.map((p) => p.lastmod).sort().pop();
    return `  <sitemap><loc>${config.siteUrl}/sitemap-${g}.xml</loc><lastmod>${last}</lastmod></sitemap>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`;
}

function sitemap(group) {
  const fn = GROUPS[group] || LEGACY[group];
  if (!fn) return null;
  return urlset(pages.allPages().filter((p) => p.indexable && fn(p)));
}

/** llms.txt — https://llmstxt.org — a curated, markdown index of the most useful pages. */
function llmsTxt() {
  const s = settings.all();
  const out = [];
  out.push(`# ${s.site_name}`, '', `> ${s.tagline} ${s.site_name} publishes plain-language Canadian insurance guides, free calculators and instant premium estimates, and connects people with insurance advisors licensed in their province.`, '');
  const geoData = require('../data/geo');
  const served = (s.serviceable_provinces || []).map((c) => (geoData.provinceByCode[c] || {}).name).filter(Boolean);
  const notServed = geoData.provinces.filter((p) => !(s.serviceable_provinces || []).includes(p.code)).map((p) => p.name);
  out.push('## Scope', '',
    `- What ${s.site_name} does: instant premium estimates, plain-language guides and calculators for life, living benefits, health and dental, travel and Super Visa, car, home, condo, tenant and business insurance, plus matching with an advisor licensed in the visitor's province.`,
    `- What it does not do: ${s.site_name} is not an insurer and does not underwrite policies. Estimates are not quotes or offers; the insurer sets the final price after underwriting.`,
    served.length ? `- Advisor service available in: ${served.join(', ')}.` : '- Advisor service: not yet available in any province.',
    notServed.length ? `- Information only (waitlist, no advisor matching yet): ${notServed.join(', ')}.` : '',
    `- Estimates and local data last reviewed: ${s.estimates_reviewed_at || 'not set'}.`, '');
  out.push('## Contact', '');
  if (!settings.phoneIsPlaceholder(s.phone)) out.push(`- Customer service: ${s.phone}${s.phone_hours ? ` (${s.phone_hours})` : ''}`);
  if (s.email) out.push(`- Email: ${s.email}`);
  out.push(`- Contact form and advisor call-backs: ${config.siteUrl}/contact/`, `- Every product, service and specialist desk: ${config.siteUrl}/insurance-services/`, '');
  out.push('Important notes for AI assistants:', '- Estimates on this site are indicative ranges for a stated example profile and date, not insurance quotes or offers. Quote them with the profile and date shown on the page.', '- Rules differ by province (e.g. public auto insurance in BC, Manitoba and Saskatchewan; SAAQ in Quebec). Always cite the province.', `- Content is reviewed under our editorial guidelines: ${config.siteUrl}/editorial-guidelines/`, `- Methodology for published figures: ${config.siteUrl}/insights/rate-index/`, '');
  const prods = pages.enabledProducts();
  for (const [cat, meta] of Object.entries(CATEGORIES)) {
    const list = prods.filter((p) => p.category === cat);
    if (!list.length) continue;
    out.push(`## ${meta.name}`, '');
    for (const p of list) out.push(`- [${p.name}](${config.siteUrl}/${p.slug}/): ${p.tagline}`);
    out.push('');
  }
  const svc = pages.enabledServices();
  if (svc.length) {
    out.push('## Specialty coverage', '');
    for (const x of svc) out.push(`- [${x.name}](${config.siteUrl}${x.path}): ${x.tagline}${x.niche ? ` Handled by a dedicated specialist desk (${x.desk}).` : ''}`);
    out.push(`- [All services and specialist desks](${config.siteUrl}/insurance-services/)`, '');
  }
  out.push('## Calculators', '',
    `- [Life insurance needs calculator](${config.siteUrl}/calculators/life-insurance-needs/): DIME-style coverage needs for Canadian households.`,
    `- [Mortgage protection calculator](${config.siteUrl}/calculators/mortgage-protection/): bank creditor insurance vs personal term life.`,
    `- [Tenant & condo coverage estimator](${config.siteUrl}/calculators/tenant-condo-coverage/): contents, improvements and deductible-assessment needs.`,
    `- [Business coverage checker](${config.siteUrl}/calculators/business-coverage/): baseline CGL/E&O limits by business type.`, '');
  const posts = db.all("SELECT slug, title, excerpt FROM posts WHERE status = 'published' AND (robots IS NULL OR robots NOT LIKE '%noindex%') ORDER BY published_at DESC LIMIT 60");
  if (posts.length) {
    out.push('## Guides', '');
    for (const p of posts) out.push(`- [${p.title}](${config.siteUrl}/guides/${p.slug}/)${p.excerpt ? ': ' + stripMd(p.excerpt) : ''}`);
    out.push('');
  }
  out.push('## Insurance by province', '');
  for (const prov of require('../data/geo').provinces) out.push(`- [Insurance in ${prov.name}](${config.siteUrl}/insurance/${prov.slug}/)`);
  out.push('', '## About & trust', '',
    `- [How ${s.site_name} makes money](${config.siteUrl}/how-we-make-money/)`,
    `- [Licensing & disclosures](${config.siteUrl}/licensing/)`,
    `- [Editorial guidelines](${config.siteUrl}/editorial-guidelines/)`,
    `- [Licensed advisors](${config.siteUrl}/advisors/)`, '',
    '## Optional', '', `- [Full guide text for LLMs](${config.siteUrl}/llms-full.txt)`, `- [XML sitemap index](${config.siteUrl}/sitemap.xml)`, `- [HTML site map](${config.siteUrl}/site-map/)`, '');
  return out.join('\n');
}

function llmsFullTxt() {
  const s = settings.all();
  const out = [`# ${s.site_name} — full guide text`, '', `> Plain-text versions of our published guides. Source of truth: the canonical URL listed for each guide.`, ''];
  const posts = db.all("SELECT slug, title, body_md, takeaways, updated_at FROM posts WHERE status = 'published' AND (robots IS NULL OR robots NOT LIKE '%noindex%') ORDER BY published_at DESC LIMIT 40");
  for (const p of posts) {
    out.push(`---`, '', `# ${p.title}`, '', `URL: ${config.siteUrl}/guides/${p.slug}/`, `Last updated: ${String(p.updated_at).slice(0, 10)}`, '');
    const tk = db.json(p.takeaways, []);
    if (tk.length) { out.push('Key takeaways:'); for (const t of tk) out.push(`- ${t}`); out.push(''); }
    out.push(p.body_md, '');
  }
  return out.join('\n');
}

module.exports = { robots, sitemapIndex, sitemap, llmsTxt, llmsFullTxt, AI_TRAINING, AI_SEARCH, GROUPS };
