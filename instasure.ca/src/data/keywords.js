'use strict';
/**
 * instasure.ca keyword map: seeded into the `keywords` table (Admin → SEO → Keyword map).
 *
 * VOLUMES ARE MODELLED ESTIMATES, NOT MEASURED DATA (volume_source = 'model').
 *   The competitor research behind this file (October 2026) could see competitors' URLs, titles
 *   and on-page data through search results, but it had no access to a keyword tool. National
 *   head-term volumes are order-of-magnitude priors for Canada (monthly Google searches). Every
 *   provincial and local figure is derived from those priors with the population model below.
 *   Use the numbers to ORDER the work, not to forecast traffic. Replace them by importing a
 *   Keyword Planner / Ahrefs / Semrush export (Admin → SEO → Keyword map → Import CSV); an
 *   import overwrites `volume` and `volume_source` for matching keywords.
 *
 * Model
 *   provincial:  vol = PROV_PER_M[product] × (provincePop / 1M)^0.9 × system × language
 *   local:       vol = CITY_PER_M[product] × (cityPop / 1M)^0.8 × premium^1.5 (car only) × system × language × community
 *   - premium = the city's autoFactor in geo.js (Brampton 1.55, Ottawa 0.85…): expensive cities
 *     search more for car insurance than their population alone predicts.
 *   - system: BC/MB/SK car insurance is sold by a public insurer (ICBC, MPI, SGI); private
 *     searches there are mostly about optional coverage, so volume ×0.5 and lead value ×0.25.
 *   - language: QC English-phrase volume ×0.3 (French phrases are listed separately).
 *   - community: super visa searches cluster in cities with large South Asian, Filipino and
 *     Chinese communities (Brampton, Surrey, Mississauga…).
 *   Calibrated so "car insurance toronto" ≈ 6,600 and "car insurance ontario" ≈ 12,000.
 *
 * Priority (1 = do first) says which page to enrich and promote first, because most target pages
 *   already exist as programmatic templates:
 *   opportunity = volume × lead value × system × serviceable × competitor gap ÷ difficulty,
 *   split into percentiles (top 8% → 1, next 17% → 2, next 30% → 3, next 25% → 4, rest → 5).
 *   Quebec rows stay at priority 3 or lower until an AMF-registered firm and French pages exist.
 *
 * target_path is a page that exists today. A null target_path means the page is not built yet;
 *   the planned URL is in `notes`. Unmapped rows are the content backlog (Admin → SEO counts them).
 *
 * Competitor coverage comes from the October 2026 SERP research. It records which competitors had
 *   a dedicated page in search results, so it understates coverage where the search budget ran out.
 */
const geo = require('./geo');
const { products } = require('./products');

const LEAD_VALUE = Object.fromEntries(products.map((p) => [p.slug, p.leadValue || 100]));
const SERVICEABLE = new Set(['on', 'bc', 'ab', 'mb', 'sk', 'ns', 'nb', 'nl', 'pe']);
const PUBLIC_AUTO = new Set(['bc', 'mb', 'sk']);

// ─────────────────────────────────────────────────────────────────────────────
// Competitor page coverage seen in search results (city slugs).
// ─────────────────────────────────────────────────────────────────────────────
const SEEN = {
  car: {
    'rates.ca': 'toronto mississauga brampton vaughan markham richmond-hill oakville burlington milton pickering ajax whitby oshawa hamilton st-catharines kitchener cambridge guelph london windsor barrie kingston sudbury thunder-bay ottawa calgary edmonton vancouver',
    ratehub: 'toronto mississauga brampton markham oakville burlington oshawa hamilton kitchener waterloo guelph london windsor barrie kingston sudbury thunder-bay ottawa calgary edmonton red-deer lethbridge vancouver montreal winnipeg regina saskatoon halifax fredericton moncton saint-john st-johns',
    sonnet: 'toronto ottawa hamilton mississauga barrie quebec-city laval',
    'mychoice/squareone/thinkinsure': 'toronto brampton mississauga ottawa hamilton',
  },
  home: {
    ratehub: 'toronto brampton mississauga hamilton windsor calgary edmonton vancouver winnipeg',
    'rates.ca': 'toronto brampton mississauga ottawa hamilton oshawa st-catharines cambridge waterloo windsor calgary edmonton',
    sonnet: 'calgary edmonton montreal laval',
    'local brokers (#1)': 'toronto brampton ottawa',
  },
  condo: { 'rates.ca': 'toronto ottawa vancouver calgary edmonton' },
  tenant: { ratehub: 'toronto calgary edmonton', 'rates.ca': 'toronto mississauga vancouver calgary edmonton' },
  life: { 'policyadvisor (stale 2024/25 titles)': 'toronto ottawa mississauga brampton hamilton vancouver' },
};
const PRODUCT_SEEN_KEY = { 'car-insurance': 'car', 'home-insurance': 'home', 'condo-insurance': 'condo', 'tenant-insurance': 'tenant', 'life-insurance': 'life' };
function competitorsFor(product, citySlug) {
  const table = SEEN[PRODUCT_SEEN_KEY[product]];
  if (!table) return [];
  return Object.entries(table).filter(([, cities]) => cities.split(' ').includes(citySlug)).map(([name]) => name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Round to two significant figures so modelled numbers do not look like measured ones. */
function round2(n) {
  if (n < 10) return 10;
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Hand-written row: [keyword, product, volume, difficulty, intent, cluster, competitors, target, priority, notes] */
function row(level, extra, [keyword, product, volume, difficulty, intent, cluster, competitors, target, priority, notes]) {
  return {
    keyword, level, product: product || null, province: extra.province || null, city: extra.city || null,
    volume, volume_source: 'model', difficulty, intent, cluster, competitors: competitors || null,
    target_path: target || null, priority, notes: notes || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Canada-wide keywords (hand-curated priors)
// ─────────────────────────────────────────────────────────────────────────────
const RH = 'ratehub', RC = 'rates.ca', PA = 'policyadvisor', SL = 'sun life', ML = 'manulife', SN = 'sonnet';
const NATIONAL = [
  // Auto
  ['car insurance', 'car-insurance', 74000, 85, 'commercial', 'auto-core', `${RH}, ${RC}, kanetix, mychoice, insurer brands`, '/car-insurance/', 2, 'Head term. Win through province and city depth rather than head-on.'],
  ['auto insurance', 'car-insurance', 33000, 82, 'commercial', 'auto-core', `${RH}, ${RC}, insurer brands`, '/car-insurance/', 3, 'Synonym. Use in H2s and meta descriptions, not a separate page.'],
  ['car insurance quotes', 'car-insurance', 14000, 78, 'transactional', 'auto-core', `${RH}, ${RC}, kanetix, lowestrates`, '/quote/car-insurance/', 1, 'Money term: send to the instant estimate flow.'],
  ['cheap car insurance', 'car-insurance', 9900, 75, 'transactional', 'auto-cost', `${RH} (15 ways), ${RC}, mychoice`, '/car-insurance/', 2, 'Answer with savings factors and compare. No "cheapest" claim without a published methodology.'],
  ['average car insurance cost canada', 'car-insurance', 2900, 55, 'informational', 'auto-cost', `${RH}, ${RC}, ${SN}, hellosafe barometer`, '/insights/rate-index/', 1, 'Rate Index page. It stays noindex until a product × province cell has 25 quote requests; the province pages carry the published averages meanwhile.'],
  ['car insurance calculator', 'car-insurance', 2400, 55, 'transactional', 'auto-tools', `${RC} (ON, AB), lowestrates (ON)`, '/quote/car-insurance/', 2, 'Instant estimate covers the intent. Planned: /calculators/car-insurance-cost/ with province selector.'],
  ['car insurance rates by province', 'car-insurance', 1000, 45, 'informational', 'auto-cost', `${SN}, ${RC}`, '/insights/rate-index/', 2],
  ['why is my car insurance going up', 'car-insurance', 1600, 35, 'informational', 'auto-regulation', `onlia, ${RC}`, '/guides/why-is-my-car-insurance-going-up-2026/', 1, 'Renewal-notice searches. Refresh each quarter with the Applied Rating Index.'],
  ['best car insurance companies canada', 'car-insurance', 1900, 60, 'commercial', 'auto-reviews', `${RH} blog, mychoice, moneygeek`, null, 3, 'Planned: /car-insurance/best-companies/. Needs a published ranking methodology first (Competition Act, RIBO).'],
  ['car insurance for new drivers', 'car-insurance', 1900, 50, 'commercial', 'auto-persona', `${RC} guide, ${RH} blog`, null, 2, 'Planned: /car-insurance/new-drivers/ (G1/G2/G, Class 7, L/N by province).'],
  ['high risk car insurance', 'car-insurance', 1600, 45, 'commercial', 'auto-persona', `${RH}, ${RC} guide, facility association`, null, 2, 'Planned: /car-insurance/high-risk/ plus sub-pages: after an accident, tickets, impaired, lapsed or cancelled.'],
  ['comprehensive vs collision insurance', 'car-insurance', 1600, 40, 'informational', 'auto-coverage', `${RC} coverage pages`, null, 3, 'Planned guide. The glossary covers the terms meanwhile.'],
  ['car insurance for newcomers to canada', 'car-insurance', 1000, 35, 'commercial', 'auto-persona', `${RH}, ${RC} guide`, null, 1, 'Planned: /car-insurance/newcomers/. Pair with multilingual advisors (Punjabi, Hindi, Tagalog, Mandarin).'],
  ['uber insurance canada', 'car-insurance', 1000, 40, 'commercial', 'auto-persona', `${RH}, mychoice, thinkinsure`, '/guides/gig-driver-insurance-uber-doordash-ontario/', 2],
  ['doordash insurance canada', 'car-insurance', 480, 25, 'commercial', 'auto-persona', 'everlance, thinkinsure', '/guides/gig-driver-insurance-uber-doordash-ontario/', 2, 'Gig drivers are the group most exposed by the Ontario accident-benefits opt-out.'],
  ['most stolen cars canada', 'car-insurance', 2400, 40, 'informational', 'auto-data', `${SN}, equite association, insurancehotline`, null, 2, 'Planned: /guides/most-stolen-cars-canada/ refreshed with each Équité report.'],
  ['car insurance after accident', 'car-insurance', 1300, 35, 'informational', 'auto-persona', `${RC}`, null, 3, 'Planned guide under the high-risk cluster.'],
  ['home and auto insurance bundle', 'car-insurance', 880, 45, 'commercial', 'auto-core', `${RH}, ${RC}`, null, 3, 'Planned: /car-insurance/home-and-auto-bundle/.'],
  ['classic car insurance', 'car-insurance', 1300, 50, 'commercial', 'auto-persona', RH, null, 4, 'Specialty market with low advisor fit.'],
  ['gap insurance canada', 'car-insurance', 1000, 40, 'informational', 'auto-coverage', `${RC}, ${RH}`, null, 4, 'FSRA warned in 2026 about unlicensed GAP sales. Explainer only.'],
  ['senior car insurance', 'car-insurance', 590, 35, 'commercial', 'auto-persona', `${RH}, ${RC} guide`, null, 3, 'Planned: /car-insurance/seniors/.'],
  ['usage based insurance canada', 'car-insurance', 590, 35, 'informational', 'auto-coverage', `${SN} shift, ${RH} survey`, null, 4, 'Planned guide: /guides/usage-based-car-insurance-canada/.'],
  ['car insurance deductible', 'car-insurance', 880, 35, 'informational', 'auto-coverage', SN, '/glossary/', 4],
  // Life
  ['life insurance', 'life-insurance', 33000, 85, 'commercial', 'life-core', `${PA}, ${SL}, ${ML}, policyme, ${RH}, canada life`, '/life-insurance/', 1, 'Highest-value head term. Province, city and cost pages feed it.'],
  ['term life insurance', 'term-life-insurance', 6600, 70, 'commercial', 'life-core', `${PA}, ${SL}, ${RH}, policyme`, '/term-life-insurance/', 1],
  ['whole life insurance', 'whole-life-insurance', 5400, 70, 'commercial', 'life-core', `${PA}, ${SL}, ${RH}`, '/whole-life-insurance/', 1],
  ['life insurance quotes', 'life-insurance', 4400, 70, 'transactional', 'life-core', `${PA} ("instantly"), policyme, ${RH}, ${SL}`, '/quote/life-insurance/', 1, 'Money term: instant estimate, then a licensed advisor.'],
  ['life insurance calculator', 'life-insurance', 2400, 60, 'transactional', 'life-tools', `${SL}, policyme, hardbacon`, '/calculators/life-insurance-needs/', 1],
  ['best life insurance companies canada', 'life-insurance', 2400, 65, 'commercial', 'life-reviews', `${PA}, wealthnorth, hellosafe`, null, 2, 'Planned: /life-insurance/best-companies/. Publish the methodology first.'],
  ['mortgage life insurance', 'mortgage-life-insurance', 2400, 55, 'commercial', 'life-mortgage', `${PA}, ${RH}, policyme, banks`, '/mortgage-life-insurance/', 1, 'About 1.15M mortgage renewals in 2026 (CMHC via MPA, verify).'],
  ['how much life insurance do i need', 'life-insurance', 1900, 55, 'informational', 'life-tools', `policyme, ${RH}, ${PA}`, '/calculators/life-insurance-needs/', 1, 'Guide twin: /guides/how-much-life-insurance-do-i-need-canada/.'],
  ['term vs whole life insurance', 'term-life-insurance', 1900, 50, 'informational', 'life-compare', `${PA}, ${SL}, ${RH}`, '/guides/term-vs-whole-life-insurance-canada/', 1],
  ['how much does life insurance cost', 'life-insurance', 1600, 55, 'informational', 'life-cost', `${PA}, policyme, ${SL} (rates pages)`, '/guides/how-much-does-life-insurance-cost-canada/', 1],
  ['life insurance for seniors', 'life-insurance', 1600, 50, 'commercial', 'life-audience', `${PA}, ${SL}`, null, 2, 'Planned: /life-insurance/seniors/ (no-medical, guaranteed issue, final expense).'],
  ['no medical life insurance', 'no-medical-life-insurance', 1300, 45, 'commercial', 'life-instant', `${PA}, ${SL} go, coverme`, '/no-medical-life-insurance/', 1, 'Core "instant" brand cluster.'],
  ['mortgage insurance vs life insurance', 'mortgage-life-insurance', 1300, 50, 'informational', 'life-mortgage', `${PA}, ${RH}, policyme, money.ca`, '/guides/mortgage-life-insurance-vs-term-life-insurance/', 1],
  ['universal life insurance', 'whole-life-insurance', 1300, 55, 'commercial', 'life-core', `${PA}, ${SL}, ${RH}`, null, 3, 'Planned section on /whole-life-insurance/ or a separate page.'],
  ['mortgage protection insurance', 'mortgage-life-insurance', 1000, 45, 'commercial', 'life-mortgage', `${PA}, ${ML} mortgage protection plan`, '/mortgage-life-insurance/', 1],
  ['final expense insurance canada', 'life-insurance', 1000, 40, 'commercial', 'life-audience', PA, null, 2, 'Planned: /life-insurance/final-expense/.'],
  ['life insurance cost by age', 'life-insurance', 880, 45, 'informational', 'life-cost', `${PA} (20/40/50 pages)`, '/guides/how-much-does-life-insurance-cost-canada/', 1, 'Planned: one page per age band (/life-insurance/cost/age-35/) once the Rate Index has quote data.'],
  ['term life insurance rates', 'term-life-insurance', 880, 55, 'commercial', 'life-cost', `${SL} (rates page), ${PA}`, '/term-life-insurance/', 2],
  ['is life insurance taxable in canada', 'life-insurance', 720, 40, 'informational', 'life-tax', PA, null, 3, 'Planned guide.'],
  ['children\'s life insurance', 'life-insurance', 720, 40, 'commercial', 'life-audience', PA, null, 4, 'Planned: /life-insurance/children/.'],
  ['guaranteed issue life insurance', 'no-medical-life-insurance', 590, 40, 'commercial', 'life-instant', `${PA}, ${SL} go guaranteed`, '/no-medical-life-insurance/', 2],
  ['joint life insurance', 'life-insurance', 590, 40, 'commercial', 'life-audience', `${SL}, ${PA}`, null, 3, 'Planned: /life-insurance/joint/.'],
  ['buy life insurance online', 'no-medical-life-insurance', 590, 40, 'transactional', 'life-instant', `${SL} go, coverme, policyme, ${PA}`, '/no-medical-life-insurance/', 1, 'Brand fit. Say "instant" only where a product truly binds online in that province.'],
  ['20 year term life insurance', 'term-life-insurance', 480, 40, 'commercial', 'life-core', SL, '/term-life-insurance/', 3],
  ['life insurance for newcomers to canada', 'life-insurance', 480, 30, 'commercial', 'life-audience', `${PA}, mychoice, iA`, '/guides/life-insurance-for-newcomers-to-canada/', 1, 'Underserved and high converting. Planned translations: Punjabi, Hindi, Mandarin, Tagalog.'],
  ['life insurance for smokers', 'life-insurance', 390, 35, 'commercial', 'life-conditions', PA, null, 3, 'Planned: /life-insurance/conditions/smokers/.'],
  ['500000 life insurance cost', 'term-life-insurance', 390, 35, 'informational', 'life-cost', PA, '/guides/how-much-does-life-insurance-cost-canada/', 2],
  ['sun life vs manulife', 'life-insurance', 390, 30, 'commercial', 'life-reviews', PA, null, 3, 'Planned: /compare/sun-life-vs-manulife-term-life/.'],
  ['1 million life insurance cost', 'term-life-insurance', 320, 35, 'informational', 'life-cost', PA, '/guides/how-much-does-life-insurance-cost-canada/', 2],
  ['life insurance for diabetics', 'life-insurance', 320, 30, 'commercial', 'life-conditions', PA, null, 3, 'Planned conditions hub: /life-insurance/conditions/{condition}/.'],
  ['life insurance work permit canada', 'life-insurance', 260, 20, 'commercial', 'life-audience', `${PA}, yahoo finance`, '/guides/life-insurance-for-newcomers-to-canada/', 1],
  ['mortgage life insurance calculator', 'mortgage-life-insurance', 260, 25, 'transactional', 'life-tools', '(none seen)', '/calculators/mortgage-protection/', 2, 'No competitor tool seen.'],
  // Living benefits / health
  ['dental insurance', 'health-dental-insurance', 8100, 65, 'commercial', 'health-dental', `${SL}, ${ML}, blue cross, ${PA}`, '/health-dental-insurance/', 2, 'Much of the volume is CDCP navigation; target the self-employed and CDCP-ineligible.'],
  ['critical illness insurance', 'critical-illness-insurance', 6600, 65, 'commercial', 'living-benefits', `${PA}, ${SL}, policyme, ${RH}`, '/critical-illness-insurance/', 1],
  ['disability insurance', 'disability-insurance', 4400, 60, 'commercial', 'living-benefits', `${PA}, ${SL}`, '/disability-insurance/', 1],
  ['long term disability insurance', 'disability-insurance', 2900, 55, 'informational', 'living-benefits', PA, '/disability-insurance/', 3, 'Much of the volume is about group or claims; qualify carefully.'],
  ['private health insurance canada', 'health-dental-insurance', 2900, 60, 'commercial', 'health-dental', `${PA}, ${SL}, ${ML}, blue cross`, '/health-dental-insurance/', 2],
  ['health and dental insurance', 'health-dental-insurance', 2400, 55, 'commercial', 'health-dental', `${PA}, ${SL}, blue cross`, '/health-dental-insurance/', 1],
  ['critical illness insurance cost', 'critical-illness-insurance', 880, 45, 'informational', 'living-benefits', `${PA}, policyme`, '/critical-illness-insurance/', 1],
  ['canadian dental care plan vs private insurance', 'health-dental-insurance', 720, 25, 'informational', 'health-dental', 'dental clinics (weak)', '/guides/private-dental-insurance-vs-cdcp/', 1, 'Weak SERP. CDCP opened to adults 18 to 64 in 2026.'],
  ['disability insurance for self employed', 'disability-insurance', 590, 35, 'commercial', 'living-benefits', PA, '/disability-insurance/', 1, 'Tie-in with the Ontario income-replacement opt-out.'],
  ['health insurance for self employed', 'health-dental-insurance', 590, 35, 'commercial', 'health-dental', PA, '/health-dental-insurance/', 2],
  ['best critical illness insurance canada', 'critical-illness-insurance', 480, 45, 'commercial', 'living-benefits', PA, null, 2, 'Planned: /critical-illness-insurance/best-companies/ with methodology.'],
  ['critical illness vs disability insurance', 'critical-illness-insurance', 390, 35, 'informational', 'living-benefits', `${PA}, ${SL}`, '/guides/critical-illness-vs-disability-insurance/', 1],
  // Travel
  ['travel insurance', 'travel-insurance', 40000, 80, 'commercial', 'travel', `${SL}, ${ML}, credit cards, ${RH}`, '/travel-insurance/', 3, 'Huge but low lead value. Capture through super visa, snowbird and visitors.'],
  ['super visa insurance', 'super-visa-insurance', 9900, 55, 'transactional', 'travel-visitors', `${PA}, hellosafe, bestquote, coverme, rbc`, '/super-visa-insurance/', 1, 'Mandatory purchase with high intent and a strong newcomer-community fit.'],
  ['visitors insurance canada', 'travel-insurance', 4400, 55, 'transactional', 'travel-visitors', `${RH}, ${RC}, ${PA}, ${SL}`, '/super-visa-insurance/', 2, 'Planned: dedicated /travel-insurance/visitors-to-canada/.'],
  ['super visa insurance cost', 'super-visa-insurance', 1600, 40, 'commercial', 'travel-visitors', `${PA}, hellosafe, bestquote`, '/guides/super-visa-insurance-requirements-cost/', 1],
  ['snowbird travel insurance', 'travel-insurance', 1300, 45, 'commercial', 'travel', '(not seen)', null, 3, 'Planned: /travel-insurance/snowbird/.'],
  ['travel insurance for seniors', 'travel-insurance', 1300, 50, 'commercial', 'travel', SL, null, 3, 'Planned: /travel-insurance/seniors/ (with the snowbird page).'],
  ['super visa insurance requirements', 'super-visa-insurance', 880, 35, 'informational', 'travel-visitors', `${PA}, rbc`, '/guides/super-visa-insurance-requirements-cost/', 1],
  ['international student health insurance canada', 'travel-insurance', 720, 40, 'commercial', 'travel-visitors', PA, null, 3, 'Planned: /travel-insurance/international-students/.'],
  ['out of province travel insurance', 'travel-insurance', 480, 35, 'informational', 'travel', SL, '/travel-insurance/', 3],
  // Property
  ['home insurance', 'home-insurance', 27000, 82, 'commercial', 'property-core', `${RH}, ${RC}, ${SN}, insurer brands`, '/home-insurance/', 1],
  ['tenant insurance', 'tenant-insurance', 15000, 70, 'commercial', 'property-core', `${SN}, ${RH}, ${RC}, squareone`, '/tenant-insurance/', 1],
  ['renters insurance', 'tenant-insurance', 9900, 65, 'commercial', 'property-core', `${SN}, ${RH}`, '/tenant-insurance/', 2, 'Synonym used in titles ("Tenant (Renters) Insurance").'],
  ['house insurance', 'home-insurance', 8100, 75, 'commercial', 'property-core', `${RH}, ${RC}`, '/home-insurance/', 2],
  ['home insurance quotes', 'home-insurance', 6600, 75, 'transactional', 'property-core', `${RH}, ${RC}, ${SN}, squareone`, '/quote/home-insurance/', 1],
  ['condo insurance', 'condo-insurance', 6600, 65, 'commercial', 'property-core', `${SN}, ${RH}, ${RC}`, '/condo-insurance/', 1],
  ['landlord insurance', 'home-insurance', 2400, 50, 'commercial', 'property-niche', `${RH}, ${RC}`, null, 2, 'Planned: /home-insurance/landlord-rental-property/.'],
  ['does home insurance cover water damage', 'home-insurance', 1600, 40, 'informational', 'property-coverage', `${RH}, CAA, RBC, westland`, '/guides/does-home-insurance-cover-water-damage-canada/', 1, 'Peaks after storms. A strong AI-citation format.'],
  ['average home insurance cost canada', 'home-insurance', 1300, 50, 'informational', 'property-cost', `${RH}, ${RC}`, '/insights/rate-index/', 1],
  ['flood insurance canada', 'home-insurance', 1300, 45, 'informational', 'property-coverage', 'money.ca, mychoice, IBC', '/guides/does-home-insurance-cover-water-damage-canada/', 2, 'The national flood program is delayed. Planned: a tracker page.'],
  ['tenant insurance cost', 'tenant-insurance', 1300, 40, 'informational', 'property-cost', `${RH}, ${SN}`, '/tenant-insurance/', 1],
  ['is tenant insurance mandatory', 'tenant-insurance', 1000, 35, 'informational', 'property-coverage', `${SN} faq, tenantrights.ca`, '/guides/tenant-insurance-ontario-landlord-require/', 1],
  ['home insurance calculator', 'home-insurance', 1000, 45, 'transactional', 'property-tools', `${RC} (AB)`, '/quote/home-insurance/', 2],
  ['overland flood insurance', 'home-insurance', 880, 40, 'informational', 'property-coverage', `${RH}, CAA`, '/guides/does-home-insurance-cover-water-damage-canada/', 1],
  ['cottage insurance', 'home-insurance', 880, 40, 'commercial', 'property-niche', `${RC} (cottage rental)`, null, 3, 'Planned: /home-insurance/cottage-seasonal/.'],
  ['why is home insurance going up', 'home-insurance', 720, 30, 'informational', 'property-cost', '(news)', null, 2, 'Property premiums rose 5.8% year over year in Q2 2026 (Applied, verify). Planned guide.'],
  ['condo insurance cost', 'condo-insurance', 720, 40, 'informational', 'property-cost', `${RH}, ${RC}`, '/condo-insurance/', 2],
  ['airbnb insurance canada', 'home-insurance', 720, 35, 'commercial', 'property-niche', '(not seen)', null, 3, 'Planned: short-term rental insurance page.'],
  ['sewer backup insurance', 'home-insurance', 590, 35, 'informational', 'property-coverage', '(brokers)', '/guides/does-home-insurance-cover-water-damage-canada/', 2],
  ['hail damage insurance', 'home-insurance', 590, 30, 'informational', 'property-coverage', 'IBC data, local brokers', '/guides/calgary-hail-insurance-guide/', 2],
  ['condo insurance deductible coverage', 'condo-insurance', 390, 25, 'informational', 'property-coverage', SN, '/guides/condo-insurance-deductible-assessment-explained/', 1],
  ['how much contents insurance do i need', 'tenant-insurance', 260, 20, 'transactional', 'property-tools', '(none seen)', '/calculators/tenant-condo-coverage/', 2],
  // Business
  ['business insurance', 'business-insurance', 8100, 70, 'commercial', 'business', `${RH}, ${RC}, zensurance, apollo`, '/business-insurance/', 1],
  ['liability insurance', 'business-insurance', 5400, 65, 'commercial', 'business', `${RH}, ${RC}`, '/business-insurance/', 3],
  ['small business insurance', 'business-insurance', 2900, 60, 'commercial', 'business', `${RC}, ${RH}`, '/business-insurance/', 1],
  ['general liability insurance', 'business-insurance', 2400, 55, 'commercial', 'business', `${RH} (CGL), ${RC}`, '/business-insurance/', 2],
  ['professional liability insurance', 'professional-liability-insurance', 1600, 50, 'commercial', 'business', `${RH}, ${RC}`, '/professional-liability-insurance/', 1],
  ['contractor insurance', 'contractor-insurance', 1300, 45, 'commercial', 'business', `${RH}, ${RC} (15+ trades)`, '/contractor-insurance/', 1],
  ['group benefits for small business', 'group-benefits', 1300, 50, 'commercial', 'business-benefits', `${PA}, ${ML}, canada life`, '/group-benefits/', 1, 'Highest lead value on the site.'],
  ['commercial auto insurance', 'business-insurance', 1300, 50, 'commercial', 'business', RC, null, 3, 'Planned: /business-insurance/commercial-auto/.'],
  ['errors and omissions insurance', 'professional-liability-insurance', 1000, 50, 'commercial', 'business', RC, '/professional-liability-insurance/', 2],
  ['small business insurance cost', 'business-insurance', 720, 40, 'informational', 'business', `${RH} blog, ${RC} (price anchors)`, '/guides/small-business-insurance-cost-canada/', 1],
  ['employee benefits for small business', 'group-benefits', 720, 45, 'commercial', 'business-benefits', PA, '/group-benefits/', 1],
  ['cyber insurance canada', 'business-insurance', 590, 45, 'commercial', 'business', RH, null, 3, 'Planned: /business-insurance/cyber/.'],
  ['key person insurance', 'life-insurance', 480, 35, 'commercial', 'business-benefits', PA, null, 2, 'Planned: /business-insurance/key-person/ (life product, business buyer).'],
  ['home based business insurance', 'business-insurance', 480, 30, 'commercial', 'business', `${RH} blog, ${SN} blog`, null, 3, 'Planned: /business-insurance/home-based/.'],
  ['plumber insurance', 'contractor-insurance', 260, 25, 'commercial', 'business-trades', RC, '/contractor-insurance/', 3, 'Planned trade pages: /contractor-insurance/{trade}/ (plumber, HVAC, electrician, cleaning, landscaping).'],
  ['trucking insurance', 'business-insurance', 1300, 50, 'commercial', 'business-trades', 'brokers, specialty MGAs', null, 3, 'Planned: /business-insurance/trucking/ (commercial auto).'],
  ['restaurant insurance', 'business-insurance', 590, 40, 'commercial', 'business-trades', `${RC} (food & beverage)`, null, 3, 'Planned: /business-insurance/restaurant/.'],
  ['contractor liability insurance', 'contractor-insurance', 480, 35, 'commercial', 'business-trades', `${RH}, ${RC}`, '/contractor-insurance/', 2],
  ['cleaning business insurance', 'contractor-insurance', 390, 25, 'commercial', 'business-trades', RC, null, 3, 'Planned: /contractor-insurance/cleaning/.'],
  ['landscaping insurance', 'contractor-insurance', 320, 25, 'commercial', 'business-trades', `${RH} blog`, null, 3, 'Planned: /contractor-insurance/landscaping/.'],
  ['electrician insurance', 'contractor-insurance', 260, 25, 'commercial', 'business-trades', '(not seen)', null, 3, 'Planned: /contractor-insurance/electrician/.'],
  ['roofing insurance', 'contractor-insurance', 260, 25, 'commercial', 'business-trades', '(not seen)', null, 3, 'Planned: /contractor-insurance/roofing/.'],
  ['handyman insurance', 'contractor-insurance', 260, 20, 'commercial', 'business-trades', '(not seen)', '/contractor-insurance/', 3],
  ['hvac insurance', 'contractor-insurance', 210, 25, 'commercial', 'business-trades', RC, null, 3, 'Planned: /contractor-insurance/hvac/.'],
  ['business insurance calculator', 'business-insurance', 140, 15, 'transactional', 'business', '(none seen)', '/calculators/business-coverage/', 3],
  // Cross-product / brand
  ['insurance broker near me', null, 6600, 60, 'local', 'advisors', 'local brokers, thinkinsure', '/advisors/', 2, 'Needs Google Business Profiles. Say "licensed advisor" unless the entity is a registered brokerage.'],
  ['insurance quotes', null, 6600, 75, 'transactional', 'brand-instant', `${RH}, ${RC}, kanetix`, '/quote/', 1],
  ['insurance advisor near me', null, 1300, 40, 'local', 'advisors', `${PA} (advisor pages), ${SL} advisor microsites`, '/advisors/', 1],
  ['compare insurance quotes canada', null, 1000, 55, 'commercial', 'brand-instant', `${RH}, ${RC}`, '/compare/', 2],
  ['instant insurance quote', null, 320, 30, 'transactional', 'brand-instant', '(fragmented)', '/quote/', 1, 'Brand-defining term for instasure.ca.'],
  ['insurance glossary', null, 260, 25, 'informational', 'brand-instant', `${RC} (car glossary)`, '/glossary/', 4],
  // Insurer brand reviews (soft SERPs per research)
  ['sonnet insurance review', 'car-insurance', 880, 30, 'commercial', 'brand-reviews', 'youset, policyme, lowestrates, comparewise', null, 3, 'Planned: /reviews/{insurer}/. Brand-review SERPs looked soft.'],
  ['intact insurance review', 'car-insurance', 590, 35, 'commercial', 'brand-reviews', `${RH}, ${RC}`, null, 4, 'Planned: /reviews/intact/ with a published review method.'],
  ['manulife life insurance review', 'life-insurance', 480, 35, 'commercial', 'brand-reviews', PA, null, 3, 'Planned: /reviews/manulife/.'],
  ['sun life life insurance review', 'life-insurance', 390, 35, 'commercial', 'brand-reviews', PA, null, 3, 'Planned: /reviews/sun-life/.'],
  ['coverme insurance review', 'life-insurance', 320, 30, 'commercial', 'brand-reviews', PA, null, 3, 'Direct-to-consumer "instant" competitor; compare honestly.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Provincial keywords
// ─────────────────────────────────────────────────────────────────────────────
const PROVINCE_PHRASE = { on: 'ontario', qc: 'quebec', bc: 'bc', ab: 'alberta', mb: 'manitoba', sk: 'saskatchewan', ns: 'nova scotia', nb: 'new brunswick', nl: 'newfoundland', pe: 'pei' };

/** Products with a province page, their search phrase and searches per million residents. */
const PROV_TERMS = [
  ['car-insurance', 'car insurance', 1020, 'auto-province', 55],
  ['home-insurance', 'home insurance', 245, 'property-province', 45],
  ['tenant-insurance', 'tenant insurance', 135, 'property-province', 38],
  ['condo-insurance', 'condo insurance', 60, 'property-province', 35],
  ['life-insurance', 'life insurance', 75, 'life-province', 40],
  ['health-dental-insurance', 'health insurance', 110, 'health-province', 45],
  ['critical-illness-insurance', 'critical illness insurance', 18, 'living-benefits', 25],
  ['disability-insurance', 'disability insurance', 22, 'living-benefits', 28],
  ['mortgage-life-insurance', 'mortgage life insurance', 14, 'life-mortgage', 25],
  ['term-life-insurance', 'term life insurance', 20, 'life-province', 30],
  ['business-insurance', 'business insurance', 100, 'business-province', 40],
  ['contractor-insurance', 'contractor insurance', 20, 'business-province', 25],
  ['group-benefits', 'group benefits', 12, 'business-benefits', 25],
  ['super-visa-insurance', 'super visa insurance', 45, 'travel-visitors', 30],
];

const PROVINCIAL_SPECIAL = [
  ['on', ['ontario auto insurance changes 2026', 'car-insurance', 4400, 45, 'informational', 'auto-regulation', `${RC}, ratelab, thinkinsure, intact, IBC, RIBO, CP24`, '/guides/ontario-auto-insurance-changes-july-2026/', 1, 'Every Ontario renewal from July 2026 to June 2027 forces the opt-out decision.']],
  ['on', ['optional accident benefits ontario', 'car-insurance', 1300, 35, 'informational', 'auto-regulation', 'intact, northbridge, thebig.ca', '/guides/ontario-auto-insurance-changes-july-2026/', 1]],
  ['on', ['income replacement benefit ontario opt out', 'car-insurance', 480, 25, 'informational', 'auto-regulation', 'thebig.ca, thinkinsure', '/guides/ontario-auto-insurance-changes-july-2026/', 1, 'Pair with the disability insurance page for self-employed drivers.']],
  ['on', ['is tenant insurance mandatory in ontario', 'tenant-insurance', 1000, 35, 'informational', 'property-coverage', 'tenantrights.ca, marathon, insurely, sonnet', '/guides/tenant-insurance-ontario-landlord-require/', 1]],
  ['on', ['ontario car insurance calculator', 'car-insurance', 880, 45, 'transactional', 'auto-tools', `${RC}, lowestrates`, '/quote/car-insurance/', 2]],
  ['on', ['g2 car insurance ontario', 'car-insurance', 880, 40, 'commercial', 'auto-persona', `${RC} (money page), ${RH} blog`, null, 2, 'Planned: /car-insurance/ontario/g2-drivers/ (also G1 and G).']],
  ['on', ['is home insurance mandatory in ontario', 'home-insurance', 590, 30, 'informational', 'property-coverage', `${SN} faq`, '/home-insurance/ontario/', 2]],
  ['ab', ['alberta car insurance increase 2026', 'car-insurance', 1900, 35, 'informational', 'auto-regulation', 'globalnews, daily hive, brokers', '/guides/alberta-car-insurance-2026-care-first/', 1, 'Alberta auto premiums rose 22.6% year over year in Q2 2026 (Applied, verify). Few aggregator pages.']],
  ['ab', ['care first auto insurance alberta', 'car-insurance', 1600, 30, 'informational', 'auto-regulation', 'alberta.ca, western financial', '/guides/alberta-car-insurance-2026-care-first/', 1, 'Starts January 1, 2027.']],
  ['ab', ['alberta good driver rate cap', 'car-insurance', 720, 30, 'informational', 'auto-regulation', 'globalnews, alberta.ca', '/guides/alberta-car-insurance-2026-care-first/', 1]],
  ['ab', ['alberta car insurance calculator', 'car-insurance', 390, 35, 'transactional', 'auto-tools', RC, '/quote/car-insurance/', 2]],
  ['ab', ['is tenant insurance mandatory in alberta', 'tenant-insurance', 260, 25, 'informational', 'property-coverage', `${SN} faq`, '/tenant-insurance/alberta/', 3]],
  ['bc', ['icbc optional insurance', 'car-insurance', 1300, 40, 'informational', 'auto-regulation', 'ICBC, BC brokers', '/guides/icbc-optional-insurance-explained/', 2, 'ICBC basic rates are frozen through 2027; optional coverage still varies.']],
  ['bc', ['icbc low kilometre discount', 'car-insurance', 480, 30, 'informational', 'auto-regulation', 'ICBC', '/guides/icbc-optional-insurance-explained/', 3]],
  ['bc', ['earthquake insurance bc', 'home-insurance', 590, 35, 'informational', 'property-coverage', `${SN} (optional in BC)`, '/home-insurance/british-columbia/', 2]],
  ['bc', ['strata insurance deductible bc', 'condo-insurance', 480, 30, 'informational', 'property-coverage', 'BC brokers', '/guides/condo-insurance-deductible-assessment-explained/', 2, 'BC strata deductibles are the national extreme. BC banned strata referral fees in 2020.']],
  ['qc', ['saaq car insurance', 'car-insurance', 1000, 40, 'informational', 'auto-regulation', `${SN} (3+ posts)`, null, 4, 'Quebec is waitlisted until AMF registration and French pages exist.']],
  ['mb', ['mpi optional insurance', 'car-insurance', 260, 25, 'informational', 'auto-regulation', 'MPI', null, 4, 'Planned explainer in the style of the ICBC guide.']],
  ['sk', ['sgi auto fund optional coverage', 'car-insurance', 210, 25, 'informational', 'auto-regulation', 'SGI', null, 4, 'Planned explainer in the style of the ICBC guide.']],
  // French (Quebec and New Brunswick). Planned under /fr/ once AMF registration and French pages exist.
  ['qc', ['assurance auto', 'car-insurance', 33000, 75, 'transactional', 'fr-quebec', `${SN}, desjardins, belairdirect, beneva`, null, 3, 'Planned: /fr/assurance-auto/. Needs AMF registration (Alternative Distribution Methods regulation), French pages and hreflang.']],
  ['qc', ['assurance habitation', 'home-insurance', 22000, 70, 'transactional', 'fr-quebec', `${SN}, desjardins, intact`, null, 3, 'Planned: /fr/assurance-habitation/.']],
  ['qc', ['assurance vie', 'life-insurance', 9900, 65, 'commercial', 'fr-quebec', 'desjardins, iA, beneva, sun life', null, 3, 'Planned: /fr/assurance-vie/. No competitor geo page seen for Quebec life insurance; PolicyAdvisor is not licensed there.']],
  ['qc', ['soumission assurance auto', 'car-insurance', 6600, 65, 'transactional', 'fr-quebec', `${SN} ("soumission 100% en ligne")`, null, 3, 'Planned: /fr/soumission/ (quote flow in French). Use "soumission" in French titles.']],
  ['qc', ['assurance locataire', 'tenant-insurance', 4400, 55, 'commercial', 'fr-quebec', SN, null, 3, 'Planned: /fr/assurance-locataire/.']],
  ['qc', ['assurance maladies graves', 'critical-illness-insurance', 1300, 40, 'commercial', 'fr-quebec', 'desjardins, sun life', null, 3, 'Planned: /fr/assurance-maladies-graves/.']],
  ['qc', ['assurance invalidité', 'disability-insurance', 1000, 40, 'commercial', 'fr-quebec', 'desjardins, iA', null, 3, 'Planned: /fr/assurance-invalidite/.']],
  ['nb', ['assurance habitation nouveau-brunswick', 'home-insurance', 140, 20, 'commercial', 'fr-quebec', SN, null, 4, 'French pages for New Brunswick francophones.']],
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Local (city) keywords
// ─────────────────────────────────────────────────────────────────────────────
/** City-page products: [product, phrase, searches per million (pop^0.8), cluster, base difficulty] */
const CITY_TERMS = [
  ['car-insurance', 'car insurance', 2070, 'auto-local', 60],
  ['home-insurance', 'home insurance', 835, 'property-local', 48],
  ['tenant-insurance', 'tenant insurance', 570, 'property-local', 40],
  ['condo-insurance', 'condo insurance', 260, 'property-local', 40],
  ['life-insurance', 'life insurance', 385, 'life-local', 35],
  ['business-insurance', 'business insurance', 260, 'business-local', 33],
  ['super-visa-insurance', 'super visa insurance', 140, 'travel-visitors', 28],
];
const SUPER_VISA_COMMUNITY = { brampton: 3, surrey: 3, mississauga: 1.8, abbotsford: 2.2, markham: 1.5, richmond: 1.5, calgary: 1.3, edmonton: 1.3, winnipeg: 1.5, scarborough: 2, toronto: 1, vancouver: 1, burnaby: 1.3, ottawa: 0.8, montreal: 0.7, saskatoon: 1, regina: 1, halifax: 0.6 };
const CITY_PHRASE = { london: 'london ontario', richmond: 'richmond bc', 'st-johns': 'st johns', 'quebec-city': 'quebec city', 'saint-john': 'saint john', 'st-catharines': 'st catharines' };

const LOCAL_SPECIAL = [
  ['on', 'toronto', ['car insurance scarborough', 'car-insurance', 1600, 50, 'local', 'auto-local', `${RC}, ${SN} ($330/mo)`, null, 1, 'Planned Toronto sub-area page (/car-insurance/ontario/toronto/scarborough/). Ratehub has none. Needs a verified population figure or no population fact.']],
  ['on', 'toronto', ['car insurance north york', 'car-insurance', 1000, 45, 'local', 'auto-local', `${RC} (generic title, no city name)`, null, 1, 'Planned Toronto sub-area page. Rates.ca\'s title omits the city: easy to beat.']],
  ['on', 'toronto', ['car insurance etobicoke', 'car-insurance', 880, 45, 'local', 'auto-local', RC, null, 2, 'Planned Toronto sub-area page.']],
  ['on', 'toronto', ['basement flood insurance toronto', 'home-insurance', 210, 25, 'local', 'property-coverage', 'mcdougall, brokers', '/guides/does-home-insurance-cover-water-damage-canada/', 2]],
  ['ab', 'calgary', ['hail insurance calgary', 'home-insurance', 390, 25, 'local', 'property-coverage', 'IBC data, local brokers', '/guides/calgary-hail-insurance-guide/', 1, 'Calgary hail on August 5, 2024 cost about $3.29B (CatIQ, verify).']],
  ['ab', 'red-deer', ['hail damage red deer', 'home-insurance', 90, 15, 'local', 'property-coverage', '(none seen)', '/guides/calgary-hail-insurance-guide/', 3]],
  // French city terms (Quebec): planned /fr/ pages
  ['qc', 'montreal', ['assurance auto montréal', 'car-insurance', 1600, 55, 'local', 'fr-quebec', `${RH} (EN only)`, null, 3, 'Planned: /fr/assurance-auto/quebec/montreal/.']],
  ['qc', 'montreal', ['assurance habitation montréal', 'home-insurance', 1000, 50, 'local', 'fr-quebec', SN, null, 3, 'Planned: /fr/assurance-habitation/quebec/montreal/.']],
  ['qc', 'quebec-city', ['assurance auto québec', 'car-insurance', 880, 50, 'local', 'fr-quebec', SN, null, 3, 'Planned: /fr/assurance-auto/quebec/ville-de-quebec/.']],
  ['qc', 'laval', ['assurance auto laval', 'car-insurance', 480, 45, 'local', 'fr-quebec', SN, null, 3, 'Planned: /fr/assurance-auto/quebec/laval/.']],
  ['qc', 'laval', ['assurance habitation laval', 'home-insurance', 320, 40, 'local', 'fr-quebec', SN, null, 4, 'Planned: /fr/assurance-habitation/quebec/laval/.']],
  ['qc', 'gatineau', ['assurance auto gatineau', 'car-insurance', 390, 35, 'local', 'fr-quebec', '(none seen)', null, 4, 'Planned: /fr/assurance-auto/quebec/gatineau/.']],
  ['qc', 'montreal', ['assurance vie montréal', 'life-insurance', 260, 25, 'local', 'fr-quebec', '(none seen)', null, 3, 'Planned: /fr/assurance-vie/quebec/montreal/.']],
];

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────
/** SERP weaknesses observed in the October 2026 captures (generic titles, local brokers at #1, title defects). */
const WEAK_SERP = { 'car-insurance/hamilton': -14, 'home-insurance/brampton': -12, 'home-insurance/ottawa': -12, 'home-insurance/hamilton': -8, 'car-insurance/brampton': -4 };
function difficultyLocal(product, base, c, comps) {
  let d = base + (c.tier === 1 ? 8 : c.tier === 3 ? -8 : 0) + Math.min(comps.length, 4) * 4 + (WEAK_SERP[`${product}/${c.slug}`] || 0);
  if (c.prov !== 'on' && !['calgary', 'edmonton', 'vancouver'].includes(c.slug)) d -= 8;
  return clamp(d, 5, 90);
}
function gapFactor(comps) {
  if (comps.some((x) => /stale/.test(x))) return 1.3;
  return comps.length === 0 ? 1.5 : comps.length === 1 ? 1.2 : comps.length === 2 ? 1 : 0.8;
}

function build() {
  const out = [];
  const scored = []; // generated rows that receive a percentile priority

  for (const r of NATIONAL) out.push(row('national', {}, r));

  // Provincial
  for (const p of geo.provinces) {
    if (p.territory) continue;
    const phrase = PROVINCE_PHRASE[p.code];
    for (const [product, term, perM, cluster, baseDiff] of PROV_TERMS) {
      const publicAuto = product === 'car-insurance' && PUBLIC_AUTO.has(p.code);
      let vol = perM * (p.population / 1e6) ** 0.9;
      if (publicAuto) vol *= 0.5;
      if (p.code === 'qc') vol *= 0.3;
      if (product === 'car-insurance' && p.code === 'ab') vol *= 1.2; // 2026 premium shock
      const comps = [];
      if (product === 'car-insurance') { comps.push(RH); if (['on', 'ab', 'qc'].includes(p.code)) comps.push(RC); if (['on', 'qc', 'ns', 'nb', 'pe'].includes(p.code)) comps.push(SN); }
      if (['home-insurance', 'tenant-insurance', 'condo-insurance'].includes(product)) { if (['on', 'ab', 'ns'].includes(p.code)) comps.push(RH); if (p.code === 'on') comps.push(RC); if (['on', 'qc', 'nb', 'ab', 'bc'].includes(p.code)) comps.push(SN); }
      if (['life-insurance', 'term-life-insurance'].includes(product) && ['on', 'bc', 'ab', 'mb'].includes(p.code)) comps.push(PA);
      if (product === 'health-dental-insurance' && ['on', 'ab', 'bc'].includes(p.code)) comps.push(PA);
      if (product === 'group-benefits' && ['ab', 'bc'].includes(p.code)) comps.push(PA);
      const volume = round2(vol);
      if (volume < 20) continue;
      const difficulty = clamp(baseDiff + (p.code === 'on' ? 12 : ['ab', 'bc', 'qc'].includes(p.code) ? 4 : -6) + comps.length * 4, 5, 90);
      const notes = [];
      if (publicAuto) notes.push(`${p.auto.publicInsurer} sells basic auto; target optional coverage. Low lead value.`);
      if (p.code === 'qc') notes.push('Quebec waitlist until AMF registration; English phrase only (French terms listed separately).');
      if (product === 'super-visa-insurance') notes.push('Province page targets super visa buyers sponsoring parents locally.');
      const k = {
        keyword: `${term} ${phrase}`, level: 'provincial', product, province: p.code, city: null,
        volume, volume_source: 'model', difficulty, intent: 'commercial', cluster,
        competitors: comps.length ? comps.join(', ') : '(none seen)', target_path: `/${product}/${p.slug}/`, priority: 3, notes: notes.join(' ') || null,
      };
      const opp = volume * (LEAD_VALUE[product] || 100) * (publicAuto ? 0.25 : 1) * (SERVICEABLE.has(p.code) ? 1 : 0.3) * gapFactor(comps) / Math.max(difficulty, 15);
      scored.push([k, opp]);
      out.push(k);
    }
  }
  for (const [prov, r] of PROVINCIAL_SPECIAL) out.push(row('provincial', { province: prov }, r));

  // Local
  for (const c of geo.cities) {
    const p = geo.provinceByCode[c.prov];
    if (p.territory) continue;
    const phrase = CITY_PHRASE[c.slug] || c.name.toLowerCase().replace(/[.’']/g, '');
    for (const [product, term, perM, cluster, baseDiff] of CITY_TERMS) {
      const publicAuto = product === 'car-insurance' && PUBLIC_AUTO.has(c.prov);
      let vol = perM * (c.pop / 1e6) ** 0.8;
      if (product === 'car-insurance') vol *= c.autoFactor ** 1.5;
      if (publicAuto) vol *= 0.5;
      if (c.prov === 'qc') vol *= 0.3;
      if (product === 'super-visa-insurance') vol *= SUPER_VISA_COMMUNITY[c.slug] || 0.5;
      const volume = round2(vol);
      if (volume < 20) continue;
      const comps = competitorsFor(product, c.slug);
      const prod = products.find((x) => x.slug === product);
      const indexable = c.tier === 1 || (c.tier === 2 && ['car-insurance', 'home-insurance', 'tenant-insurance', 'condo-insurance'].includes(product));
      const difficulty = difficultyLocal(product, baseDiff, c, comps);
      const notes = [];
      if (!indexable) notes.push('Page exists but is noindex until an editor adds a 300+ character local intro (Admin → SEO → Page overrides).');
      if (publicAuto) notes.push(`${p.auto.publicInsurer} sells basic auto; target optional coverage. Low lead value.`);
      if (c.prov === 'qc') notes.push('Quebec waitlist until AMF registration.');
      if (comps.some((x) => /stale/.test(x))) notes.push('Competitor city page carries a stale year in its title: freshness opening.');
      const k = {
        keyword: `${term} ${phrase}`, level: 'local', product, province: c.prov, city: c.slug,
        volume, volume_source: 'model', difficulty, intent: 'local', cluster,
        competitors: comps.length ? comps.join(', ') : '(none seen)', target_path: `/${product}/${p.slug}/${c.slug}/`, priority: 3, notes: notes.join(' ') || null,
      };
      const opp = volume * (prod.leadValue || 100) * (publicAuto ? 0.25 : 1) * (SERVICEABLE.has(c.prov) ? 1 : 0.3) * gapFactor(comps) * (indexable ? 1 : 0.4) / Math.max(difficulty, 15);
      scored.push([k, opp]);
      out.push(k);

      // Modifier variants for the biggest car markets: the "cheap" and "how much" intents.
      if (product === 'car-insurance' && c.tier === 1 && !publicAuto && c.prov !== 'qc') {
        for (const [mod, share, intent, note] of [
          [`cheap car insurance ${phrase}`, 0.35, 'transactional', 'Rates.ca titles lead with "Cheap"; answer with factors and FSA data, not a price promise.'],
          [`how much is car insurance in ${phrase}`, 0.2, 'informational', 'Ratehub ranks a blog post for this. The city page answers it in the first two sentences with a dated average.'],
        ]) {
          const v = round2(vol * share);
          if (v < 20) continue;
          const kk = { ...k, keyword: mod, volume: v, intent, difficulty: clamp(difficulty - 5, 5, 90), notes: note };
          scored.push([kk, v * (prod.leadValue || 100) * gapFactor(comps) / Math.max(kk.difficulty, 15)]);
          out.push(kk);
        }
      }
    }
    // Local advisor intent on the city hub page
    if (c.tier === 1 && SERVICEABLE.has(c.prov)) {
      const v = round2(300 * (c.pop / 1e6) ** 0.8);
      if (v >= 20) {
        const k = {
          keyword: `insurance advisor ${phrase}`, level: 'local', product: null, province: c.prov, city: c.slug,
          volume: v, volume_source: 'model', difficulty: 30, intent: 'local', cluster: 'advisors',
          competitors: 'local brokers, thinkinsure, rates.ca (broker pages)', target_path: `/insurance/${p.slug}/${c.slug}/`, priority: 3,
          notes: 'City hub. Add a Google Business Profile only where an advisor really works from that city.',
        };
        scored.push([k, v * 250 / 30]);
        out.push(k);
      }
    }
  }
  for (const [prov, city, r] of LOCAL_SPECIAL) out.push(row('local', { province: prov, city }, r));

  // Percentile priorities for generated rows.
  scored.sort((a, b) => b[1] - a[1]);
  const n = scored.length;
  scored.forEach(([k], i) => {
    const pct = i / n;
    k.priority = pct < 0.08 ? 1 : pct < 0.25 ? 2 : pct < 0.55 ? 3 : pct < 0.8 ? 4 : 5;
    if (k.province === 'qc' && k.priority < 3) k.priority = 3;
  });

  // De-duplicate (first occurrence wins) and sort: level, then volume.
  const seen = new Set();
  const LEVEL = { national: 0, provincial: 1, local: 2 };
  return out
    .filter((k) => { const key = k.keyword.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => LEVEL[a.level] - LEVEL[b.level] || b.volume - a.volume);
}

const keywords = build();
module.exports = { keywords, model: { PROV_TERMS, CITY_TERMS, SEEN } };
