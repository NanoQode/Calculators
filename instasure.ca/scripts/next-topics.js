'use strict';
// CLI: npm run guides:next -- [count=3] → the next planned blog topics, as JSON, from docs/blog-content-plan.csv.
// Order: status Planned · not gated · priority 1 first · keyword-map volume · volume tier · one per segment.
// Gated (skipped) topics: those whose compliance note says not to publish until a ranking/review method exists,
// and Quebec topics while Quebec is waitlisted. See docs/BLOG_PUBLISHING.md.
const fs = require('node:fs');
const path = require('node:path');
const { keywords } = require('../src/data/keywords');

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...data] = rows;
  return data.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const count = Number(process.argv[2] || 3);
const plan = parseCsv(fs.readFileSync(path.join(__dirname, '..', 'docs', 'blog-content-plan.csv'), 'utf8'));
const published = new Set(fs.readdirSync(path.join(__dirname, '..', 'src', 'content', 'guides')).map((f) => f.replace(/\.md$/, '')));
const vol = Object.fromEntries(keywords.map((k) => [k.keyword.toLowerCase(), k.volume]));
const TIER = { High: 4, Medium: 3, Low: 2, Niche: 1 };
const slugOf = (r) => (r.URL.match(/\/guides\/([^/]+)\//) || [])[1];
const gated = (r) => /do not publish until|publish(ed)? (a |the )?(ranking|review) method|methodology is (live|published)/i.test(r['Compliance & facts to verify']) || /quebec/i.test(r['Geo scope']);

const pool = plan.filter((r) => r.Status === 'Planned' && !published.has(slugOf(r)) && !gated(r))
  .map((r) => ({ r, v: vol[String(r['Focus keyword']).toLowerCase()] || 0 }))
  .sort((a, b) => Number(a.r['Priority (1 = first)']) - Number(b.r['Priority (1 = first)']) || b.v - a.v || (TIER[b.r['Volume tier (modelled)']] || 0) - (TIER[a.r['Volume tier (modelled)']] || 0) || a.r['Topic ID'].localeCompare(b.r['Topic ID']));
const pick = [], segs = new Set();
for (const x of pool) { if (pick.length >= count) break; if (segs.has(x.r['Insurance segment'])) continue; pick.push(x); segs.add(x.r['Insurance segment']); }
for (const x of pool) { if (pick.length >= count) break; if (!pick.includes(x)) pick.push(x); }
// Keywords from the keyword map for the same product line(s), highest volume first: use them in H2s, body and
// local sections (with links to their target pages), alongside the topic's own focus and secondary keywords.
const SEGMENT_PRODUCTS = {
  'Life insurance': ['life-insurance', 'term-life-insurance', 'whole-life-insurance', 'no-medical-life-insurance'], 'Mortgage protection': ['mortgage-life-insurance'],
  'Critical illness insurance': ['critical-illness-insurance'], 'Disability insurance': ['disability-insurance'], 'Health & dental insurance': ['health-dental-insurance'],
  'Group benefits': ['group-benefits'], 'Travel insurance': ['travel-insurance'], 'Super Visa & visitors insurance': ['super-visa-insurance', 'travel-insurance'],
  'Car insurance': ['car-insurance'], 'Recreational vehicles': ['car-insurance'], 'Home insurance': ['home-insurance'], 'Condo insurance': ['condo-insurance'],
  'Tenant insurance': ['tenant-insurance'], 'Landlord & rental property': ['home-insurance'], 'Pet insurance': ['home-insurance'],
  'Business insurance': ['business-insurance'], 'Contractor & trades insurance': ['contractor-insurance'], 'Professional liability (E&O)': ['professional-liability-insurance'],
  'Insurance basics & consumer rights': [null],
};
const related = (r) => {
  const prods = SEGMENT_PRODUCTS[r['Insurance segment']] || [];
  const own = new Set([r['Focus keyword'], ...String(r['Secondary keywords']).split(';')].map((k) => k.trim().toLowerCase()));
  // Service pages that belong to another segment even though their keywords sit under a shared product line.
  const OTHER = { '/pet-insurance/': 'Pet insurance', '/boat-insurance/': 'Recreational vehicles', '/rv-insurance/': 'Recreational vehicles', '/motorcycle-insurance/': 'Recreational vehicles',
    '/atv-snowmobile-insurance/': 'Recreational vehicles', '/landlord-insurance/': 'Landlord & rental property', '/home-insurance/short-term-rental/': 'Landlord & rental property' };
  const foreign = (k) => OTHER[k.target_path] && OTHER[k.target_path] !== r['Insurance segment'];
  return keywords.filter((k) => prods.includes(k.product) && !own.has(k.keyword.toLowerCase()) && !/fr-quebec/.test(k.cluster) && !foreign(k))
    .sort((a, b) => b.volume - a.volume).slice(0, 12)
    .map((k) => ({ keyword: k.keyword, volume: k.volume, level: k.level, target_path: k.target_path }));
};
console.log(JSON.stringify(pick.map(({ r, v }) => ({ slug: slugOf(r), keyword_map_volume: v || null, related_keywords: related(r), ...r })), null, 1));
console.error(`[next-topics] ${pool.length} eligible planned topics; picked ${pick.length}`);
