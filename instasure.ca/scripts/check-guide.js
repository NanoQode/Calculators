'use strict';
// CLI: npm run guides:check -- <file.md> […]
// Pre-publish quality gate for a guide file (docs/BLOG_PUBLISHING.md). Exits 1 if any ERROR is found.
// Checks front matter, title and description lengths, keyword placement, structure, internal links
// (must resolve to a live page or another guide), sources, compliance wording and the site's SEO audit.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (!process.env.DB_PATH) process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'instasure-check-')), 'check.db');
require('../src/db').open();
const pages = require('../src/lib/pages');
const { parseGuide, CATEGORY_FOR } = require('../src/db/seed');
const { products } = require('../src/data/products');
const geo = require('../src/data/geo');
const AUTHORS = require('../src/data/authors');
const { audit } = require('../public/js/seo-audit');

const GUIDE_DIR = path.join(__dirname, '..', 'src', 'content', 'guides');
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: check-guide <file.md> …'); process.exit(2); }

const valid = new Set(pages.allPages().map((p) => p.path));
for (const f of fs.readdirSync(GUIDE_DIR).filter((x) => x.endsWith('.md'))) valid.add(`/guides/${f.replace(/\.md$/, '')}/`);
for (const f of files) valid.add(`/guides/${path.basename(f).replace(/\.md$/, '')}/`);
['/quote/', '/contact/'].forEach((p) => valid.add(p));
for (const p of products) valid.add(`/quote/${p.slug}/`);
const productSlugs = new Set(products.map((p) => p.slug));
const provinceCodes = new Set(geo.provinces.map((p) => p.code));
const authorSlugs = new Set(AUTHORS.map((a) => a.slug).concat(['instasure-advisor-team']));
const plan = (() => {
  const f = path.join(__dirname, '..', 'docs', 'blog-content-plan.csv');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
})();

const words = (t) => t.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|[\]()-]/g, ' ').split(/\s+/).filter(Boolean);
const lc = (t) => String(t || '').toLowerCase().replace(/-/g, ' ');
let failed = 0;

for (const file of files) {
  const E = [], W = [];
  let g;
  try { g = parseGuide(file); } catch (e) { console.log(`✖ ${file}\n  ERROR front matter: ${e.message}`); failed++; continue; }
  const m = g.meta, body = g.body, slug = path.basename(file).replace(/\.md$/, '');
  const need = ['title', 'slug', 'seo_title', 'meta_description', 'excerpt', 'category', 'content_type', 'focus_keyword', 'keywords', 'products', 'takeaways', 'faq', 'sources', 'author'];
  for (const k of need) if (m[k] === undefined || m[k] === '' || (Array.isArray(m[k]) && !m[k].length && k !== 'provinces')) E.push(`missing ${k}`);
  if (m.slug !== slug) E.push(`slug "${m.slug}" must equal the file name "${slug}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) E.push('slug must be lowercase kebab-case, ≤ 70 characters');
  const st = String(m.seo_title || ''), md = String(m.meta_description || '');
  if (st.length < 30 || st.length > 60) E.push(`seo_title ${st.length} chars (30–60)`);
  if (md.length < 120 || md.length > 160) E.push(`meta_description ${md.length} chars (120–160)`);
  if (String(m.excerpt || '').length < 80 || String(m.excerpt || '').length > 320) E.push('excerpt should be 80–320 chars');
  if (!CATEGORY_FOR[m.category]) E.push(`category must be one of ${Object.keys(CATEGORY_FOR).join(', ')}`);
  if (!['guide', 'comparison', 'data', 'news', 'checklist'].includes(m.content_type)) E.push('content_type must be guide, comparison, data, news or checklist');
  if ((m.keywords || []).length < 4) E.push('keywords: list at least 4 secondary keywords');
  for (const p of m.products || []) if (!productSlugs.has(p)) E.push(`unknown product slug "${p}"`);
  for (const p of m.provinces || []) if (!provinceCodes.has(p)) E.push(`unknown province code "${p}"`);
  if (!authorSlugs.has(m.author)) E.push(`author "${m.author}" is not a known author slug`);
  const tk = m.takeaways || [];
  if (tk.length < 3 || tk.length > 6) E.push(`takeaways: ${tk.length} (3–6)`);
  const faq = m.faq || [];
  if (faq.length < 3 || faq.length > 6) E.push(`faq: ${faq.length} (3–6)`);
  faq.forEach((f, i) => { if (!/\?$/.test(String(f.q || '').trim())) E.push(`faq ${i + 1} question must end with "?"`); if (String(f.a || '').length < 60) E.push(`faq ${i + 1} answer too short`); });
  const src = m.sources || [];
  if (src.length < 3) E.push(`sources: ${src.length} (at least 3 primary sources)`);
  src.forEach((s, i) => { if (!s.title || !/^https:\/\//.test(s.url || '')) E.push(`source ${i + 1} needs a title and an https url`); });

  if (/^#\s/m.test(body)) E.push('body must not contain an H1 (# …); the title is the H1');
  const h2 = body.match(/^##\s+.+$/gm) || [];
  if (h2.length < 4) E.push(`only ${h2.length} H2 sections (4+)`);
  const wc = words(body).length;
  const minWords = m.content_type === 'news' ? 600 : 1100;
  if (wc < minWords) E.push(`${wc} words (minimum ${minWords})`);
  const kw = lc(m.focus_keyword);
  if (!lc(words(body).slice(0, 100).join(' ')).includes(kw)) E.push('focus keyword not in the first 100 words');
  if (!lc(st).includes(kw) && !lc(m.title).includes(kw)) E.push('focus keyword not in the seo_title or title');
  if (!lc(md).includes(kw)) W.push('focus keyword (exact phrase) not in the meta description');
  if (!h2.some((h) => lc(h).includes(kw))) W.push('focus keyword not in any H2');
  const links = [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((x) => x[1]);
  const internal = links.filter((l) => l.startsWith('/'));
  for (const l of internal) { const pathOnly = l.split('#')[0].split('?')[0]; if (!valid.has(pathOnly)) E.push(`internal link not found on the site: ${l}`); }
  for (const l of links.filter((x) => !x.startsWith('/') && !x.startsWith('#'))) if (!/^https:\/\//.test(l)) E.push(`external link must be https: ${l}`);
  if (internal.length < 4) E.push(`${internal.length} internal links (4+: money page, quote or desk, related guides)`);
  if (/\b(TODO|TBD|lorem ipsum)\b|\[verify|\[citation|\{\{|XX%|\$X\b/i.test(body + JSON.stringify(m))) E.push('placeholder text left in the file');
  if (/\b(cheapest|lowest price|guaranteed (approval|lowest|best))\b/i.test(`${m.title} ${st} ${md}`)) E.push('price-promise wording in title or description (no "cheapest", "lowest price", "guaranteed")');
  if (/\bbest\b/i.test(`${m.title} ${st}`)) W.push('"best" in the title: only with a published ranking method');
  if (!/^##\s+Michael['’]s take/im.test(body) && !/\*\*Michael['’]s take/i.test(body)) W.push('no "Michael\'s take" section');
  if (plan && !plan.includes(`/guides/${slug}/`)) W.push('slug is not in docs/blog-content-plan.csv');

  const a = audit({ title: m.title, seoTitle: st, metaDescription: md, slug, bodyMd: body, focusKeyword: m.focus_keyword, excerpt: m.excerpt,
    faq, takeaways: tk, sources: src, products: m.products || [], contentType: m.content_type, siteHost: 'instasure.ca' });
  const miss = a.checks.filter((c) => !c.ok).map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ''}`);
  if (a.score < 85) E.push(`SEO audit score ${a.score} (85+ required): ${miss.join('; ')}`);
  else if (miss.length) W.push(`SEO audit ${a.score}: ${miss.join('; ')}`);

  console.log(`${E.length ? '✖' : '✔'} ${slug}  ${wc} words · ${h2.length} H2 · ${internal.length} internal links · ${src.length} sources · SEO ${a.score}`);
  E.forEach((x) => console.log(`  ERROR ${x}`));
  W.forEach((x) => console.log(`  warn  ${x}`));
  if (E.length) failed++;
}
process.exitCode = failed ? 1 : 0;
