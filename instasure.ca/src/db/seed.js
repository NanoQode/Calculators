'use strict';
/**
 * Idempotent seed: safe to run repeatedly. Inserts only what is missing.
 *  - settings (IndexNow key), admin user, guide categories
 *  - SAMPLE advisors (is_demo=1, shown with a "Sample profile" badge, noindex, never emailed)
 *  - default lead-scoring rules, drip campaigns (CASL: express consent required by default)
 *  - keyword map from the competitive research
 *  - guides from src/content/guides/*.md (published, awaiting licensed review)
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./index');
const config = require('../config');
const settings = require('../lib/settings');
const auth = require('../lib/auth');
const scoring = require('../lib/scoring');
const publisher = require('../lib/publisher');
const { sqlNow } = require('../lib/util');
const AUTHORS = require('../data/authors');

const CATEGORIES = [
  ['life-insurance', 'Life insurance', 'Term, whole and no-medical life insurance explained for Canadians.', 'personal'],
  ['living-benefits', 'Health & living benefits', 'Critical illness, disability and health & dental coverage.', 'personal'],
  ['home-property', 'Home, condo & tenant', 'Protecting your home, belongings and liability across Canada.', 'residential'],
  ['auto', 'Auto insurance', 'Car insurance rules, costs and changes by province.', 'auto'],
  ['travel-visitors', 'Travel & visitors', 'Travel medical and Super Visa insurance.', 'personal'],
  ['business', 'Business insurance', 'Liability, property and benefits for Canadian small businesses.', 'commercial'],
  ['claims-rules', 'Claims & provincial rules', 'How claims, complaints and provincial regulation work.', 'claims'],
];
const CATEGORY_FOR = { life: 'life-insurance', health: 'living-benefits', home: 'home-property', auto: 'auto', travel: 'travel-visitors', business: 'business', claims: 'claims-rules' };

const ADVISORS = [
  { slug: 'sample-jordan-lee', specialties: ['life-insurance-medical-conditions', 'newcomer-life-insurance', 'snowbird-travel-insurance', 'mortgage-life-insurance'], name: 'Jordan Lee', designations: 'LLQP', title: 'Life & Living Benefits Advisor (sample profile)', provinces: ['on', 'bc'], categories: ['life', 'health', 'travel'], languages: ['en', 'zh'], years: 9,
    licences: [{ province: 'on', regulator: 'FSRA', type: 'Life & A&S agent' }, { province: 'bc', regulator: 'Insurance Council of BC', type: 'Life agent' }],
    bio: 'Sample profile for layout and routing tests. Replace with a real licensed advisor in **Admin → Advisors** before launch.\n\nSpecialises in term life, critical illness and Super Visa coverage for young families and newcomers.' },
  { slug: 'sample-amrit-sandhu', specialties: ['newcomer-car-insurance', 'newcomer-life-insurance', 'super-visa-insurance', 'high-risk-car-insurance', 'rideshare-delivery-insurance', 'ontario-accident-benefits-review', 'self-employed-disability-insurance'], name: 'Amrit Sandhu', designations: 'LLQP, CIP', title: 'Senior Insurance Advisor (sample profile)', provinces: ['on', 'ab'], categories: ['life', 'health', 'travel', 'auto', 'property'], languages: ['en', 'pa', 'hi'], years: 12,
    licences: [{ province: 'on', regulator: 'FSRA', type: 'Life & A&S agent' }, { province: 'ab', regulator: 'Alberta Insurance Council', type: 'General insurance agent' }],
    bio: 'Sample profile for layout and routing tests. Replace with a real licensed advisor before launch.\n\nHelps Brampton, Mississauga and Calgary families with life, Super Visa, home and auto coverage in English, Punjabi and Hindi.' },
  { slug: 'sample-sam-okafor', specialties: ['commercial-auto-insurance', 'hard-to-insure-homes', 'short-term-rental-insurance', 'condo-insurance'], name: 'Sam Okafor', designations: 'CAIB', title: 'Commercial & Property Broker (sample profile)', provinces: ['ab', 'sk', 'mb', 'on'], categories: ['business', 'property', 'auto'], languages: ['en'], years: 8,
    licences: [{ province: 'ab', regulator: 'Alberta Insurance Council', type: 'General insurance broker' }, { province: 'on', regulator: 'RIBO', type: 'Registered insurance broker' }],
    bio: 'Sample profile for layout and routing tests. Replace with a real licensed broker before launch.\n\nWorks with contractors, consultants and retailers on CGL, E&O and property packages.' },
  { slug: 'sample-taylor-macdonald', specialties: ['cottage-seasonal-insurance', 'hard-to-insure-homes', 'snowbird-travel-insurance'], name: 'Taylor MacDonald', designations: 'LLQP, CIP', title: 'Atlantic Canada Advisor (sample profile)', provinces: ['ns', 'nb', 'pe', 'nl'], categories: ['life', 'health', 'property', 'auto', 'travel'], languages: ['en', 'fr'], years: 15,
    licences: [{ province: 'ns', regulator: 'NS Superintendent of Insurance', type: 'Life & general agent' }, { province: 'nb', regulator: 'FCNB', type: 'Life & general agent' }],
    bio: 'Sample profile for layout and routing tests. Replace with a real licensed advisor before launch.\n\nServes Halifax, Moncton, Saint John and St. John’s households with home, auto and life insurance.' },
];

// ───────────── Drip campaign library (all CASL-compliant: identification + unsubscribe added by the mailer) ─────────────
const H = 1, D = 24;
const CAMPAIGNS = [
  {
    slug: 'life-health-follow-up', name: 'Life & living benefits — quote follow-up', trigger: 'lead_created', priority: 10,
    description: 'Educates and books a call after a life, critical illness, disability or health quote.',
    filters: { product_categories: ['life', 'health'], lead_types: ['quote', 'calculator', 'consult'] },
    steps: [
      [2 * H, '{{first_name}}, a quick hello from {{advisor_first_name}}', 'What happens next with your {{product_short}} quote', 'Hi {{first_name}},\n\nI’m {{advisor_name}}, and I’ll be looking after your {{product_short}} request (ref **{{ref}}**).\n\nHere’s how I’ll help:\n\n1. **Confirm the right amount and term** so you’re not over- or under-insured.\n2. **Compare insurers** — prices for the same coverage can differ a lot depending on your health and lifestyle.\n3. **Handle the application** — many healthy applicants can skip the medical exam.\n\nThe fastest way to get real quotes is a 15-minute call.', 'Pick a time that suits you', '{{advisor_booking_url}}'],
      [2 * D, '3 things that change your {{product_short}} price', 'Health class, term length and riders explained', 'Hi {{first_name}},\n\nYour estimate was **{{estimate_low}}–{{estimate_high}}{{estimate_period}}**. Three things move the final price most:\n\n- **Health classification.** Insurers sort applicants into classes. Healthy non-smokers often qualify for “preferred” rates.\n- **Term length.** Matching the term to your mortgage and kids’ ages avoids paying for years you don’t need.\n- **Riders.** Waiver of premium or child riders add value, but only some are worth it for you.\n\nWant me to run the numbers on a few options?', 'Review my options', '{{quote_url}}'],
      [5 * D, 'Can you skip the medical exam?', 'No-exam life insurance — who qualifies', 'Hi {{first_name}},\n\nMany Canadians can now get life insurance **without needles or a nurse visit**. Healthy applicants under about 50 are often approved on health questions alone.\n\nIf you have a health condition, simplified-issue plans can still work — they just cost a bit more.\n\n[Read how no-medical life insurance works]({{site_url}}/no-medical-life-insurance/).', 'Ask {{advisor_first_name}} if you qualify', '{{advisor_booking_url}}'],
      [10 * D, 'How much coverage do you really need?', 'A 2-minute calculator for Canadian families', 'Hi {{first_name}},\n\nThe right amount depends on your mortgage, debts, income and kids — not a rule of thumb.\n\nOur free calculator works it out in two minutes, and it includes coverage you might already have through work.', 'Use the calculator', '{{site_url}}/calculators/life-insurance-needs/'],
      [21 * D, 'Still thinking it over, {{first_name}}?', 'No pressure — here’s where things stand', 'Hi {{first_name}},\n\nNo rush on our side. Your estimate stays saved under **{{ref}}**, and I’m happy to answer questions whenever you’re ready.\n\nIf now isn’t the right time, you can unsubscribe below and we won’t email again.', 'See my saved estimate', '{{quote_url}}'],
    ],
  },
  {
    slug: 'property-follow-up', name: 'Home, condo & tenant — quote follow-up', trigger: 'lead_created', priority: 10,
    description: 'Follow-up for home, condo and tenant insurance quotes.',
    filters: { product_categories: ['property'], lead_types: ['quote', 'calculator', 'consult'] },
    steps: [
      [1 * H, 'Your {{product_short}} insurance quote — next steps', 'A licensed advisor is reviewing your request', 'Hi {{first_name}},\n\n{{advisor_name}} is comparing insurers for your {{product_short}} insurance in {{city_name}}. Expect real quotes shortly.\n\nOne question to think about before you choose: **how much water damage coverage do you need?**', 'Book a quick call', '{{advisor_booking_url}}'],
      [2 * D, 'The water-damage gap in most policies', 'Sewer backup and overland flood are usually extras', 'Hi {{first_name}},\n\nWater damage is now one of the most common home insurance claims in Canada. Standard policies usually **exclude overland flooding** and often treat **sewer backup** as an add-on.\n\n[Read our water damage guide]({{site_url}}/guides/does-home-insurance-cover-water-damage-canada/) before you pick a policy.', 'Ask about water coverage', '{{advisor_booking_url}}'],
      [6 * D, 'Bundling could lower both premiums', 'Home + auto discounts explained', 'Hi {{first_name}},\n\nMost insurers discount both policies when you bundle home, condo or tenant insurance with car insurance. It’s often the single biggest saving available.\n\nWant {{advisor_first_name}} to check a bundle price?', 'Get a bundle quote', '{{site_url}}/quote/car-insurance/'],
      [14 * D, 'Any questions about your coverage?', 'We’re here when you’re ready', 'Hi {{first_name}},\n\nJust checking in on your {{product_short}} insurance (ref {{ref}}). If you’ve already sorted it out — great! If not, we’re a reply away.', 'View my estimate', '{{quote_url}}'],
    ],
  },
  {
    slug: 'auto-follow-up', name: 'Auto — quote follow-up', trigger: 'lead_created', priority: 10,
    description: 'Follow-up for car insurance quotes, with province-aware tips.',
    filters: { product_categories: ['auto'], lead_types: ['quote', 'calculator', 'consult'] },
    steps: [
      [1 * H, 'Your car insurance quote in {{city_name}}', 'A licensed broker is shopping your rate', 'Hi {{first_name}},\n\n{{advisor_name}} is comparing insurers for your car insurance in {{province_name}}. Your estimate was **{{estimate_low}}–{{estimate_high}}{{estimate_period}}**.\n\nHave your licence number and current policy handy — it makes the call quicker.', 'Book a quick call', '{{advisor_booking_url}}'],
      [2 * D, 'Ways to lower your car insurance', 'Discounts most drivers miss', 'Hi {{first_name}},\n\nA few changes can make a real difference:\n\n- Bundle with home or tenant insurance\n- Ask about winter-tire and telematics discounts\n- Review your deductibles and optional coverages\n- Keep a clean record — and ask about accident forgiveness\n\n[Why premiums are rising — and what you can do]({{site_url}}/guides/why-is-my-car-insurance-going-up-2026/).', 'Check my discounts', '{{advisor_booking_url}}'],
      [7 * D, 'When does your policy renew?', 'Shop 30–45 days before renewal', 'Hi {{first_name}},\n\nThe best time to compare is 30–45 days before your renewal date. Reply with your renewal date and we’ll reach out at the right time.', 'Update my details', '{{quote_url}}'],
    ],
  },
  {
    slug: 'business-follow-up', name: 'Business — quote follow-up', trigger: 'lead_created', priority: 10,
    description: 'Follow-up for business, contractor, E&O and group benefits quotes.',
    filters: { product_categories: ['business'], lead_types: ['quote', 'calculator', 'consult'] },
    steps: [
      [1 * H, 'Your business insurance quote', 'Next steps from your commercial broker', 'Hi {{first_name}},\n\n{{advisor_name}} is preparing quotes for your business. If a client or landlord needs a **certificate of insurance**, mention the deadline — we can often move quickly.', 'Book a call', '{{advisor_booking_url}}'],
      [2 * D, 'Does your business need cyber coverage?', 'If you store customer data, read this', 'Hi {{first_name}},\n\nIf you take payments online or store customer information, a data breach can trigger notification costs and claims under Canadian privacy law. Cyber coverage is often affordable for small firms.\n\n[Check your coverage needs]({{site_url}}/calculators/business-coverage/).', 'Ask about cyber', '{{advisor_booking_url}}'],
      [10 * D, 'Checking in on your business coverage', 'Questions? We’re a reply away', 'Hi {{first_name}},\n\nJust following up on your business insurance request (ref {{ref}}). Happy to help whenever you’re ready.', 'View my estimate', '{{quote_url}}'],
    ],
  },
  {
    slug: 'travel-follow-up', name: 'Travel & Super Visa — quote follow-up', trigger: 'lead_created', priority: 10,
    description: 'Follow-up for travel and Super Visa quotes.',
    filters: { product_categories: ['travel'], lead_types: ['quote', 'calculator', 'consult'] },
    steps: [
      [1 * H, 'Your {{product_short}} insurance quote', 'Documents and next steps', 'Hi {{first_name}},\n\n{{advisor_name}} will confirm plans that meet your needs. For Super Visa applications, IRCC requires proof of eligible medical insurance — we’ll make sure your documents are in order.', 'Book a call', '{{advisor_booking_url}}'],
      [3 * D, 'Your Super Visa insurance checklist', 'Coverage, deductibles and refunds', 'Hi {{first_name}},\n\nBefore you buy, check: coverage of at least $100,000 for one year, the deductible, how stable pre-existing conditions are treated, and the refund policy if the visa is refused.\n\n[Read the full guide]({{site_url}}/guides/super-visa-insurance-requirements-cost/).', 'Compare plans with an advisor', '{{advisor_booking_url}}'],
    ],
  },
  {
    slug: 'abandoned-quote', name: 'Abandoned quote recovery', trigger: 'quote_abandoned', priority: 20,
    description: 'Reminds people who saved a quote but did not finish (stops automatically once they complete it).',
    filters: { lead_types: ['partial'] },
    steps: [
      [3 * H, 'Your {{product_short}} quote is saved', 'Pick up where you left off', 'Hi {{first_name}},\n\nYour answers are saved — it takes about a minute to finish and see your options.', 'Finish my quote', '{{product_url}}'],
      [2 * D, 'Questions before you finish?', 'A licensed advisor can help', 'Hi {{first_name}},\n\nIf something in the quote wasn’t clear — health questions, coverage amounts, deductibles — a licensed advisor can walk you through it. No obligation.', 'Talk to an advisor', '{{site_url}}/contact/?type=consult'],
    ],
  },
  {
    slug: 'long-term-nurture', name: 'Long-term nurture (status: nurture)', trigger: 'status_changed', priority: 5,
    description: 'Low-frequency educational emails for leads moved to "nurture".',
    filters: { statuses: ['nurture'] },
    steps: [
      [7 * D, 'A quick insurance check-up', 'Life changes that affect your coverage', 'Hi {{first_name}},\n\nMoving, a new baby, a mortgage renewal or a new business are all moments to review your coverage. Our guides make it quick.', 'Browse guides', '{{site_url}}/guides/'],
      [45 * D, 'What’s changing in Canadian insurance', 'Updates for {{province_name}}', 'Hi {{first_name}},\n\nRules and prices keep changing across Canada. Here’s the latest for {{province_name}}.', 'See {{province_name}} updates', '{{site_url}}/insurance/'],
      [120 * D, 'Ready to revisit your quote?', 'Your saved estimate', 'Hi {{first_name}},\n\nIt’s been a while. If your situation has changed, a fresh estimate takes about a minute.', 'Get a new estimate', '{{site_url}}/quote/'],
    ],
  },
];

function parseGuide(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error(`No front matter in ${file}`);
  return { meta: JSON.parse(m[1]), body: m[2].trim() };
}

const advisorId = (slug) => (slug ? (db.get('SELECT id FROM advisors WHERE slug = ?', [slug]) || {}).id || null : null);

/** Post columns from a parsed guide file (front matter + body). `author`/`reviewer` are advisor slugs. */
function guideRow(g, slug) {
  const cat = db.get('SELECT id FROM categories WHERE slug = ?', [CATEGORY_FOR[g.meta.category] || 'claims-rules']);
  const defaultAuthor = (AUTHORS.find((a) => a.default) || {}).slug;
  return {
    slug, title: g.meta.title, excerpt: g.meta.excerpt, body_md: g.body, content_type: g.meta.content_type || 'guide',
    category_id: cat ? cat.id : null, tags: g.meta.keywords || [],
    seo_title: g.meta.seo_title, meta_description: g.meta.meta_description,
    focus_keyword: g.meta.focus_keyword, keywords: g.meta.keywords || [], faq: g.meta.faq || [], takeaways: g.meta.takeaways || [],
    sources: g.meta.sources || [], products: g.meta.products || [], provinces: g.meta.provinces || [],
    author_id: advisorId(g.meta.author || defaultAuthor), reviewer_id: advisorId(g.meta.reviewer),
    featured_image: g.meta.featured_image || null, image_alt: g.meta.image_alt || null,
  };
}

/**
 * Publish guide files from a directory: each slug not yet in the database is inserted and published now
 * (rendered, scored, cache purged, IndexNow pinged). Existing slugs are skipped unless `update` is set,
 * so edits made in the admin are never overwritten by accident.
 */
async function publishGuideFiles(dir, { update = false, only = null } = {}) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const g = parseGuide(path.join(dir, f));
    const slug = g.meta.slug || f.replace(/\.md$/, '');
    if (only && !only.includes(slug)) continue;
    const existing = db.get('SELECT id FROM posts WHERE slug = ?', [slug]);
    if (existing && !update) continue;
    const row = guideRow(g, slug);
    let id;
    if (existing) { db.update('posts', existing.id, { ...row, updated_at: sqlNow() }); id = existing.id; } else id = db.insert('posts', { ...row, status: 'draft' });
    const r = await publisher.publish(id);
    out.push({ slug, url: `${config.siteUrl}/guides/${slug}/`, created: !existing, words: r.post.word_count, seo_score: r.post.seo_score, indexnow: r.ping });
  }
  return out;
}

function importGuides({ force = false } = {}) {
  const dir = path.join(config.ROOT, 'src', 'content', 'guides');
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  files.forEach((f, idx) => {
    let g;
    try { g = parseGuide(path.join(dir, f)); } catch (e) { console.warn('[seed] skip', f, e.message); return; }
    const slug = g.meta.slug || f.replace(/\.md$/, '');
    const existing = db.get('SELECT id FROM posts WHERE slug = ?', [slug]);
    if (existing && !force) return;
    // Stagger publish dates so "latest" ordering looks natural.
    const published = sqlNow(-(files.length - idx) * 36 * 3600 * 1000);
    const row = { ...guideRow(g, slug), status: 'published', published_at: published, updated_at: sqlNow() };
    let id;
    if (existing) { db.update('posts', existing.id, row); id = existing.id; } else id = db.insert('posts', row);
    publisher.recompile(id);
    n++;
  });
  return n;
}

function seed({ quiet = false } = {}) {
  db.open();
  const log = (...a) => { if (!quiet) console.log('[seed]', ...a); };

  if (!settings.get('indexnow_key')) settings.set('indexnow_key', crypto.randomBytes(16).toString('hex'));

  if (!db.value('SELECT COUNT(*) FROM users')) {
    const password = config.adminPassword || crypto.randomBytes(9).toString('base64url');
    db.insert('users', { email: config.adminEmail, name: 'Site Admin', password_hash: auth.hashPassword(password), role: 'admin' });
    log(`admin user created → ${config.adminEmail} / ${config.adminPassword ? '(from ADMIN_PASSWORD)' : password}`);
    if (!config.adminPassword && !quiet) log('Save this password now — it is not shown again. Change it in Admin → Users.');
  }

  CATEGORIES.forEach(([slug, name, description, hub], i) => {
    if (!db.get('SELECT id FROM categories WHERE slug = ?', [slug])) db.insert('categories', { slug, name, description, hub, sort: i });
  });

  if (!db.value('SELECT COUNT(*) FROM advisors')) {
    for (const a of ADVISORS) {
      db.insert('advisors', {
        slug: a.slug, name: a.name, title: a.title, designations: a.designations, bio_md: a.bio,
        languages: a.languages, provinces: a.provinces, licences: a.licences, categories: a.categories, specialties: a.specialties || [],
        years_experience: a.years, is_demo: 1, booking_url: null, email: null,
      });
    }
    log(`${ADVISORS.length} SAMPLE advisors created (flagged is_demo — replace before launch)`);
  }
  // Named authors (src/data/authors.js): insert if missing, never overwrite admin edits. The first time the
  // default author is created, guides without an author are attributed to them.
  for (const a of AUTHORS) {
    if (db.get('SELECT id FROM advisors WHERE slug = ?', [a.slug])) continue;
    const id = db.insert('advisors', {
      slug: a.slug, name: a.name, title: a.title, designations: a.designations, photo: a.photo, bio_md: a.bio_md,
      languages: a.languages, provinces: a.provinces, licences: a.licences || [], categories: a.categories, specialties: [],
      years_experience: a.years_experience || null, active: 1, accepting_leads: a.accepting_leads ? 1 : 0, is_demo: 0,
    });
    log(`author ${a.name} created`);
    if (a.default) {
      const n = db.run('UPDATE posts SET author_id = ? WHERE author_id IS NULL', [id]).changes;
      if (n) log(`${n} guides attributed to ${a.name}`);
    }
  }

  // Databases created before specialist desks existed: give the sample advisors their demo desks once.
  for (const a of ADVISORS) {
    db.run("UPDATE advisors SET specialties = ? WHERE slug = ? AND is_demo = 1 AND (specialties IS NULL OR specialties = '[]')", [JSON.stringify(a.specialties || []), a.slug]);
  }

  if (!db.value('SELECT COUNT(*) FROM scoring_rules')) {
    scoring.DEFAULT_RULES.forEach(([name, category, field, operator, value, points], i) => db.insert('scoring_rules', { name, category, field, operator, value, points, sort: i }));
    scoring.invalidate();
    log('default scoring rules created');
  }

  for (const c of CAMPAIGNS) {
    if (db.get('SELECT id FROM campaigns WHERE slug = ?', [c.slug])) continue;
    const id = db.insert('campaigns', { slug: c.slug, name: c.name, description: c.description, trigger: c.trigger, filters: c.filters, priority: c.priority, require_express_consent: 1 });
    c.steps.forEach(([delay, subject, preheader, body, ctaLabel, ctaUrl], i) => db.insert('campaign_steps', { campaign_id: id, position: i, delay_hours: delay, subject, preheader, body_md: body, cta_label: ctaLabel, cta_url: ctaUrl }));
    log(`campaign "${c.name}" created (${c.steps.length} steps)`);
  }

  const kwFile = path.join(config.ROOT, 'src', 'data', 'keywords.js');
  if (fs.existsSync(kwFile)) {
    const { keywords } = require(kwFile);
    let n = 0, mapped = 0;
    for (const k of keywords) {
      const have = db.get('SELECT id, target_path FROM keywords WHERE keyword = ?', [k.keyword]);
      if (!have) { db.insert('keywords', { ...k, volume_source: k.volume_source || 'model' }); n++; continue; }
      // A page planned earlier now exists: point the stored keyword at it, but never overwrite a mapping set in the admin.
      if (!have.target_path && k.target_path) { db.run('UPDATE keywords SET target_path = ?, notes = ? WHERE id = ?', [k.target_path, k.notes || null, have.id]); mapped++; }
    }
    if (n) log(`${n} keywords imported`);
    if (mapped) log(`${mapped} keywords mapped to newly built pages`);
  }

  const g = importGuides();
  if (g) log(`${g} guides imported`);
  settings.invalidate();
  return true;
}

module.exports = { seed, importGuides, publishGuideFiles, guideRow, parseGuide, CAMPAIGNS, ADVISORS, CATEGORY_FOR };
