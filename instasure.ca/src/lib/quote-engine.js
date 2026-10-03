'use strict';
/**
 * Instant estimate engine.
 *
 * Produces INDICATIVE premium ranges (low / typical / high) for every product line from a
 * transparent actuarial-style model calibrated to typical 2025–26 Canadian market pricing.
 * Every result carries an example-profile description and "as of" date so advertised
 * "from $X" figures comply with advertising guidance.
 *
 * Architecture: `providers` is an ordered list. Today only the model provider is active.
 * Phase 2: plug in carrier/aggregator rating APIs (e.g. life quoting engines, CSIO/P&C rating)
 * by adding a provider whose `supports(flow)` returns true — results then show real carrier rows.
 */
const geo = require('../data/geo');
const { bySlug } = require('../data/products');
const { money, monthYear, clampInt } = require('./util');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerpTable = (table, x) => {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (x <= keys[0]) return table[keys[0]];
  if (x >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (x >= a && x <= b) {
      // log-linear interpolation: premiums grow ~exponentially with age
      const t = (x - a) / (b - a);
      return Math.exp(Math.log(table[a]) * (1 - t) + Math.log(table[b]) * t);
    }
  }
  return table[keys[0]];
};
const round = (n, step = 1) => Math.round(n / step) * step;

// Monthly cost per $1,000 of coverage, Term 20, male, non-smoker, standard-plus health.
const TERM20_M_NS = { 18: 0.046, 25: 0.046, 30: 0.048, 35: 0.057, 40: 0.08, 45: 0.124, 50: 0.2, 55: 0.33, 60: 0.56, 65: 1.0, 70: 1.8, 75: 3.1 };
const TERM_FACTOR = { 10: 0.72, 20: 1, 30: 1.55, 65: 1.5 };
const TERM_MAX_AGE = { 10: 75, 20: 65, 30: 55, 65: 55 };
const WHOLE_M_NS = { 18: 0.62, 25: 0.68, 30: 0.76, 35: 0.86, 40: 1.0, 45: 1.3, 50: 1.65, 55: 2.1, 60: 2.8, 65: 3.8, 70: 5.2 };
// Critical illness: monthly per $1,000, Term 10, comprehensive, non-smoker
const CI_NS = { 18: 0.32, 25: 0.34, 30: 0.4, 35: 0.5, 40: 0.68, 45: 0.95, 50: 1.35, 55: 1.9, 60: 2.7, 65: 3.6 };
// Super Visa: annual premium, $100k, $0 deductible, no pre-existing
const SUPER_VISA = { 40: 900, 50: 1150, 55: 1350, 60: 1650, 65: 2000, 70: 2800, 75: 3900, 80: 5800, 85: 8600, 89: 11000 };
// Travel emergency medical, per-day by age (worldwide incl. USA)
const TRAVEL_DAY = { 18: 2.2, 40: 2.6, 55: 4.5, 60: 5.5, 65: 7.5, 70: 11, 75: 17, 80: 27, 85: 40 };

function ageFromInput(i) {
  if (i.age) return clampInt(i.age, 16, 90, 35);
  if (i.dob) {
    const d = new Date(i.dob);
    if (!isNaN(d)) {
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
      return clamp(a, 16, 90);
    }
  }
  return 35;
}

function provinceOf(i) {
  return geo.provinceByCode[String(i.province || '').toLowerCase()] || geo.provinceFromPostal && geo.provinceByCode[geo.provinceFromPostal(i.postal_code)] || geo.provinceByCode.on;
}
function cityOf(i, prov) {
  return i.city ? geo.cityByKey[`${prov.code}/${i.city}`] : null;
}

function range(mid, spread = 0.18, step = 1, min = 5) {
  const m = Math.max(min, mid);
  return { low: Math.max(min, round(m * (1 - spread), step)), mid: round(m, step), high: round(m * (1 + spread * 1.2), step) };
}

// ───────────────────────── Flow models ─────────────────────────
function life(i, product) {
  const age = ageFromInput(i);
  const female = i.sex === 'female';
  const smoker = i.smoker === 'yes' || i.smoker === true;
  const coverage = clamp(Number(i.coverage) || 500000, 25000, 10000000);
  let term = Number(i.term) || 20;
  if (!TERM_FACTOR[term]) term = 20;
  const notes = [];
  const permanent = product.slug === 'whole-life-insurance' || i.plan === 'whole';
  let perK;
  if (permanent) {
    perK = lerpTable(WHOLE_M_NS, age) * (female ? 0.82 : 1) * (smoker ? 1.75 : 1);
  } else {
    if (age > TERM_MAX_AGE[term]) {
      notes.push(`Term ${term === 65 ? 'to 65' : term} is usually not available at age ${age}; showing Term 10 instead.`);
      term = 10;
    }
    perK = lerpTable(TERM20_M_NS, age) * TERM_FACTOR[term] * (female ? 0.76 : 1) * (smoker ? (age < 45 ? 2.4 : 2.8) : 1);
  }
  const band = coverage < 250000 ? 1.18 : coverage < 500000 ? 1.06 : coverage >= 1000000 ? 0.9 : 1;
  const noMed = product.slug === 'no-medical-life-insurance' || i.underwriting === 'no-exam';
  let monthly = (coverage / 1000) * perK * band + 3; // + policy fee
  if (noMed) { monthly *= 1.3; notes.push('Simplified-issue (no-medical) pricing assumed; healthy applicants may qualify for exam-waived full underwriting at lower rates.'); }
  monthly = Math.max(monthly, 12);
  const r = range(monthly, 0.16, 0.5, 10);
  const label = permanent ? 'Whole life (participating, life-pay)' : `Term ${term === 65 ? 'to 65' : term}`;
  return {
    period: 'month', ...r,
    headline: `${money(coverage)} · ${label}`,
    example: `${age}-year-old ${female ? 'female' : 'male'}, ${smoker ? 'smoker' : 'non-smoker'}, ${money(coverage)} ${label}`,
    tiers: permanent
      ? [
          tier('par', 'Participating whole life', 'Dividends', r.mid * 1.0, ['Guaranteed premiums for life', 'Eligible for annual dividends', 'Cash value you can borrow against'], 'Full underwriting'),
          tier('nonpar', 'Non-par whole life', 'Lowest permanent price', r.mid * 0.78, ['Guaranteed premiums & death benefit', 'Lower cost, no dividends', 'Simple and predictable'], 'Full underwriting'),
          tier('t100', 'Term to 100', 'Pure lifetime coverage', r.mid * 0.62, ['Coverage for life with minimal cash value', 'Often the cheapest permanent option', 'Good for estate tax needs'], 'Full underwriting'),
        ]
      : [
          tier('instant', 'Instant / no-exam term', 'Fastest', r.mid * (noMed ? 1 : 1.07), ['Online application in ~10–20 minutes', 'Decision in minutes to days for eligible applicants', 'No needles or nurse visit'], 'Health questions + database checks', true),
          tier('full', 'Fully underwritten term', 'Lowest price', r.mid * (noMed ? 0.74 : 0.93), ['Usually the lowest premium if you are healthy', 'Highest coverage limits', 'Medical exam may be required at higher amounts'], 'Full underwriting (1–4 weeks)'),
          tier('flex', 'Convertible term + riders', 'Most flexible', r.mid * (noMed ? 0.86 : 1.12), ['Convert to permanent coverage without new medicals', 'Add child, waiver-of-premium or CI riders', 'Strong insurer financial strength'], 'Full underwriting'),
        ],
    notes,
    meta: { age, coverage, term, smoker, sex: female ? 'female' : 'male', permanent },
  };
}

function health(i, product) {
  const age = ageFromInput(i);
  const female = i.sex === 'female';
  const smoker = i.smoker === 'yes' || i.smoker === true;
  if (product.slug === 'critical-illness-insurance') {
    const coverage = clamp(Number(i.coverage) || 100000, 10000, 2000000);
    let perK = lerpTable(CI_NS, age) * (smoker ? 1.9 : 1) * (female ? (age < 45 ? 1.06 : 0.86) : 1);
    if (coverage >= 250000) perK *= 0.92;
    const monthly = Math.max(15, (coverage / 1000) * perK + 2);
    const r = range(monthly, 0.18, 0.5, 12);
    return {
      period: 'month', ...r,
      headline: `${money(coverage)} critical illness · Term 10`,
      example: `${age}-year-old ${female ? 'female' : 'male'}, ${smoker ? 'smoker' : 'non-smoker'}, ${money(coverage)} comprehensive CI, Term 10`,
      tiers: [
        tier('basic', 'Basic (cancer, heart attack, stroke)', 'Lowest price', r.mid * 0.62, ['Covers the 3 conditions behind most claims', 'Lump sum after 30-day survival', 'Simplified underwriting options'], 'Health questions'),
        tier('comp', 'Comprehensive (25+ conditions)', 'Recommended', r.mid, ['25+ covered conditions', 'Early-stage partial payments on many plans', 'Optional return of premium'], 'Full underwriting', true),
        tier('rop', 'Comprehensive + return of premium', 'Money back', r.mid * 1.45, ['Premiums refunded at expiry/surrender if no claim (conditions apply)', 'Same broad condition list', 'Higher premium'], 'Full underwriting'),
      ],
      notes: [], meta: { age, coverage, smoker },
    };
  }
  if (product.slug === 'disability-insurance') {
    const income = clamp(Number(i.income) || 80000, 20000, 500000);
    const occ = { office: 0.022, professional: 0.026, light: 0.033, trades: 0.045, heavy: 0.058 }[i.occupation] || 0.026;
    const benefit = Math.min(Math.round((income * 0.65) / 12 / 50) * 50, 20000);
    const ageF = age < 30 ? 0.8 : age < 40 ? 1 : age < 50 ? 1.35 : 1.8;
    const monthly = Math.max(35, benefit * occ * ageF * (smoker ? 1.3 : 1) * (female ? 1.25 : 1));
    const r = range(monthly, 0.2, 1, 30);
    return {
      period: 'month', ...r,
      headline: `${money(benefit)}/mo benefit · 90-day wait · to age 65`,
      example: `${age}-year-old ${female ? 'female' : 'male'}, ${money(income)} income, ${i.occupation || 'professional'} occupation, ${money(benefit)}/mo benefit, 90-day waiting period`,
      tiers: [
        tier('ss', 'Accident & sickness (short benefit period)', 'Budget', r.mid * 0.55, ['2–5 year benefit period', 'Simplified underwriting', 'Lower premium'], 'Health questions'),
        tier('ltd', 'Long-term disability to 65', 'Recommended', r.mid, ['Benefits to age 65', 'Own- or regular-occupation definitions', 'Guaranteed renewable'], 'Full underwriting', true),
        tier('own', 'Own-occupation + cost-of-living rider', 'Best protection', r.mid * 1.35, ['Own-occupation definition for professionals', 'Benefits indexed to inflation', 'Future insurability options'], 'Full underwriting'),
      ],
      notes: [], meta: { age, income, benefit },
    };
  }
  // health & dental
  const family = i.household === 'family' ? 2.4 : i.household === 'couple' ? 1.9 : 1;
  const ageF = age < 30 ? 0.85 : age < 45 ? 1 : age < 55 ? 1.2 : age < 65 ? 1.45 : 1.7;
  const monthly = 92 * family * ageF;
  const r = range(monthly, 0.25, 1, 40);
  return {
    period: 'month', ...r,
    headline: `Health & dental · ${i.household || 'single'}`,
    example: `${age}-year-old, ${i.household || 'single'} coverage, mid-tier plan`,
    tiers: [
      tier('basic', 'Basic plan', 'Guaranteed issue', r.mid * 0.6, ['Prescription drugs and basic dental', 'No medical questions', 'Lower annual maximums'], 'No health questions'),
      tier('mid', 'Mid-tier plan', 'Most popular', r.mid, ['Drugs, dental, vision and paramedical', 'Moderate annual maximums', 'Optional major dental'], 'Short health questionnaire', true),
      tier('comp', 'Comprehensive plan', 'Best coverage', r.mid * 1.55, ['Higher limits and major dental', 'Broad paramedical incl. mental health', 'Travel medical options'], 'Health questionnaire'),
    ],
    notes: [], meta: { age },
  };
}

function travel(i, product) {
  const age = ageFromInput(i);
  if (product.slug === 'super-visa-insurance') {
    const visitorAge = clampInt(i.visitor_age || i.age, 40, 89, 62);
    const cov = clamp(Number(i.coverage) || 100000, 100000, 300000);
    const covF = cov >= 300000 ? 1.32 : cov >= 200000 ? 1.2 : cov >= 150000 ? 1.12 : 1;
    const ded = Number(i.deductible) || 0;
    const dedF = ded >= 2500 ? 0.75 : ded >= 1000 ? 0.82 : ded >= 500 ? 0.9 : 1;
    const preF = i.preexisting === 'yes' ? 1.35 : 1;
    const annual = lerpTable(SUPER_VISA, visitorAge) * covF * dedF * preF;
    const r = range(annual / 12, 0.2, 1, 40);
    return {
      period: 'month', ...r, annual: range(annual, 0.2, 10, 400),
      headline: `${money(cov)} Super Visa medical · $${ded} deductible`,
      example: `${visitorAge}-year-old visitor, ${money(cov)} coverage, ${money(ded)} deductible, ${i.preexisting === 'yes' ? 'stable pre-existing conditions covered' : 'no pre-existing coverage'}, 12 months`,
      tiers: [
        tier('min', '$100,000 IRCC minimum', 'Lowest price', (r.mid / covF) * 1, ['Meets the IRCC minimum (confirm current rules)', 'Emergency hospital, medical & repatriation', 'Monthly payments available from many insurers'], 'Age-based, no medical exam'),
        tier('std', `${money(cov)} coverage`, 'Selected', r.mid, ['Higher protection for serious emergencies', 'Refund if visa refused (policy conditions)', 'Pre-existing options for stable conditions'], 'Medical questionnaire for pre-existing option', true),
        tier('max', '$300,000 + stable pre-existing', 'Best protection', (r.mid / covF / preF) * 1.32 * 1.35, ['Highest common limit', 'Stable pre-existing conditions covered', 'Best for visitors 70+'], 'Medical questionnaire'),
      ],
      notes: ['IRCC requirements change — always confirm the latest Super Visa insurance rules on canada.ca before applying.'],
      meta: { visitorAge, cov },
    };
  }
  const days = clampInt(i.days, 1, 365, 14);
  const perDay = lerpTable(TRAVEL_DAY, age) * (i.destination === 'canada-excluded-usa' ? 0.7 : 1);
  const trip = Math.max(25, perDay * days);
  const r = range(trip, 0.2, 1, 20);
  return {
    period: 'trip', ...r,
    headline: `${days}-day trip · emergency medical`,
    example: `${age}-year-old travelling ${days} days to the USA/worldwide, emergency medical only`,
    tiers: [
      tier('med', 'Emergency medical', 'Essential', r.mid, ['$5M–$10M emergency medical', 'Medical evacuation', 'Pre-existing stability clauses apply'], 'Medical questionnaire 60+', true),
      tier('pkg', 'All-inclusive package', 'Most complete', r.mid * 1.9, ['Medical + trip cancellation/interruption', 'Baggage and delay', 'Flight accident'], 'Medical questionnaire 60+'),
      tier('annual', 'Annual multi-trip', 'Frequent travellers', Math.max(r.mid * 2.4, 120), ['Unlimited trips up to a set length each', 'Great for 3+ trips a year', 'Snowbird options'], 'Medical questionnaire 60+'),
    ],
    notes: [], meta: { age, days },
  };
}

function auto(i, product) {
  const prov = provinceOf(i);
  const city = cityOf(i, prov);
  const age = ageFromInput(i);
  const base = prov.benchmarks.autoAnnual;
  const ageF = age < 20 ? 2.4 : age < 25 ? 1.6 : age < 35 ? 1.12 : age < 55 ? 1 : age < 70 ? 0.9 : 1.05;
  const yrs = clampInt(i.years_licensed, 0, 70, 10);
  const yrsF = yrs < 2 ? 1.45 : yrs < 5 ? 1.18 : yrs < 10 ? 1.05 : 0.95;
  const tickets = clampInt(i.tickets, 0, 10, 0);
  const claims = clampInt(i.claims, 0, 10, 0);
  const vehF = { economy: 0.9, standard: 1, suv: 1.08, luxury: 1.3, 'high-theft': 1.45, ev: 1.15 }[i.vehicle_class] || 1;
  const covF = i.coverage_level === 'liability' ? 0.58 : i.coverage_level === 'premium' ? 1.12 : 1;
  const cityF = city ? city.autoFactor : 1;
  const annual = base * cityF * ageF * yrsF * Math.pow(1.18, tickets) * Math.pow(1.35, claims) * vehF * covF;
  const r = range(annual / 12, 0.2, 1, 40);
  const where = city ? `${city.name}, ${prov.abbr}` : prov.name;
  const notes = [];
  if (prov.auto.system === 'public') notes.push(`${prov.name} drivers buy basic coverage from ${prov.auto.publicInsurer}. This estimate includes basic plus typical optional coverage; savings come mainly from optional coverage, bundling and discounts.`);
  if (prov.auto.system === 'hybrid') notes.push('In Quebec, bodily injury is covered by the SAAQ; this estimate covers private property-damage and liability insurance.');
  if (prov.code === 'on') notes.push('Ontario: since July 1, 2026 several accident benefits are optional — your advisor will show the price of each option.');
  if (prov.code === 'ab') notes.push('Alberta: 2026 good-driver rate cap applies to eligible drivers; Care-First begins January 1, 2027.');
  return {
    period: 'month', ...r, annual: range(annual, 0.2, 10, 500),
    headline: `Car insurance · ${where}`,
    example: `${age}-year-old driver in ${where}, ${yrs}+ years licensed, ${tickets} tickets, ${claims} at-fault claims, ${i.vehicle_class || 'standard'} vehicle, ${i.coverage_level === 'liability' ? 'liability only' : 'full coverage'}`,
    tiers: [
      tier('min', 'Mandatory + liability', 'Lowest price', r.mid * 0.62, ['Province-required coverage', 'Higher liability limit recommended', 'No collision or comprehensive'], 'Driving record & vehicle'),
      tier('rec', 'Full coverage', 'Recommended', r.mid, ['$1–2M liability', 'Collision & comprehensive', 'Accident forgiveness where eligible'], 'Driving record & vehicle', true),
      tier('plus', 'Full + endorsements', 'Most protection', r.mid * 1.15, ['Rental car & waiver of depreciation', 'Lower deductibles', 'Higher accident benefits'], 'Driving record & vehicle'),
    ],
    notes, meta: { province: prov.code, city: city && city.slug, age },
    benchmark: { annual: base, source: prov.benchmarks.autoSource || 'Instasure modelled provincial average' },
  };
}

const HAIL = { calgary: 1.28, airdrie: 1.2, 'red-deer': 1.15, lethbridge: 1.12, edmonton: 1.1, saskatoon: 1.08, regina: 1.08, winnipeg: 1.05 };
const FLOOD = { abbotsford: 1.12, richmond: 1.06, laval: 1.08, gatineau: 1.06, fredericton: 1.06, 'saint-john': 1.05, toronto: 1.04 };

function property(i, product) {
  const prov = provinceOf(i);
  const city = cityOf(i, prov);
  const where = city ? `${city.name}, ${prov.abbr}` : prov.name;
  const perilF = city ? (HAIL[city.slug] || 1) * (FLOOD[city.slug] || 1) : 1;
  const claims = clampInt(i.claims, 0, 10, 0);
  if (product.slug === 'tenant-insurance' || product.slug === 'condo-insurance') {
    const condo = product.slug === 'condo-insurance';
    const contents = clamp(Number(i.contents) || (condo ? 50000 : 30000), 5000, 500000);
    const improvements = condo ? clamp(Number(i.improvements) || 25000, 0, 500000) : 0;
    const base = condo ? prov.benchmarks.condoMonthly : prov.benchmarks.tenantMonthly;
    const monthly = base * Math.pow((contents + improvements) / (condo ? 75000 : 30000), 0.5) * Math.sqrt(perilF) * Math.pow(1.2, claims);
    const r = range(monthly, 0.22, 1, 12);
    return {
      period: 'month', ...r,
      headline: `${condo ? 'Condo' : 'Tenant'} insurance · ${where}`,
      example: `${where}, ${money(contents)} contents${condo ? `, ${money(improvements)} improvements, $50,000 deductible assessment` : ''}, $2M liability, $1,000 deductible`,
      tiers: [
        tier('basic', 'Named perils', 'Lowest price', r.mid * 0.8, ['Covers listed perils like fire and theft', '$1M liability', 'Higher deductible'], 'No inspection'),
        tier('comp', 'Comprehensive (all-risk)', 'Recommended', r.mid, ['All risks unless excluded', '$2M liability', 'Additional living expenses'], 'No inspection', true),
        tier('water', 'Comprehensive + water endorsements', 'Best protection', r.mid * 1.18, ['Sewer backup & above-ground water', condo ? 'Higher deductible-assessment limit' : 'Identity theft & bikes', 'Lower deductible'], 'No inspection'),
      ],
      notes: condo ? ['Ask your property manager for the corporation’s water-damage deductible and buy at least that much deductible-assessment coverage.'] : [],
      meta: { province: prov.code, city: city && city.slug, contents },
    };
  }
  const rebuild = clamp(Number(i.rebuild) || 500000, 100000, 5000000);
  const built = clampInt(i.year_built, 1850, new Date().getFullYear(), 1995);
  const ageF = built < 1960 ? 1.22 : built < 1990 ? 1.08 : 1;
  const ded = Number(i.deductible) || 1000;
  const dedF = ded >= 5000 ? 0.8 : ded >= 2500 ? 0.88 : 1;
  const waterF = i.water === 'no' ? 0.9 : 1;
  const annual = prov.benchmarks.homeAnnual * Math.pow(rebuild / 500000, 0.75) * ageF * dedF * waterF * perilF * Math.pow(1.25, claims);
  const r = range(annual / 12, 0.2, 1, 40);
  return {
    period: 'month', ...r, annual: range(annual, 0.2, 10, 400),
    headline: `Home insurance · ${where}`,
    example: `${where}, ${money(rebuild)} rebuild cost, built ${built}, ${money(ded)} deductible, ${i.water === 'no' ? 'no' : 'with'} water endorsements`,
    tiers: [
      tier('basic', 'Standard comprehensive', 'Lowest price', r.mid * 0.88, ['Replacement cost dwelling', '$1M liability', 'No water endorsements'], 'Property details'),
      tier('rec', 'Comprehensive + water', 'Recommended', r.mid, ['Sewer backup & overland water (where available)', '$2M liability', 'Guaranteed replacement cost options'], 'Property details', true),
      tier('plus', 'Premium protection', 'Most protection', r.mid * 1.2, ['Higher limits on jewellery & bikes', 'Identity theft & equipment breakdown', prov.code === 'bc' ? 'Earthquake endorsement' : 'Service line coverage'], 'Property details'),
    ],
    notes: HAIL[city && city.slug] ? ['Hail is a major claim driver here — ask about impact-resistant roofing discounts.'] : [],
    meta: { province: prov.code, city: city && city.slug, rebuild },
  };
}

const INDUSTRY = {
  consulting: { label: 'Consulting / IT / professional', cgl: 650, eo: 1200 },
  retail: { label: 'Retail / studio / clinic', cgl: 1400, eo: 900 },
  trades: { label: 'Skilled trade / contractor', cgl: 2600, eo: 0 },
  food: { label: 'Restaurant / food service', cgl: 3200, eo: 0 },
  realestate: { label: 'Real estate / property services', cgl: 900, eo: 1600 },
  health: { label: 'Health & wellness practitioner', cgl: 700, eo: 1100 },
  ecommerce: { label: 'E-commerce / online business', cgl: 800, eo: 900 },
};

function business(i, product) {
  const prov = provinceOf(i);
  if (product.slug === 'group-benefits') {
    const employees = clampInt(i.employees, 1, 500, 5);
    const perEmp = i.plan === 'hsa' ? 110 : i.plan === 'comprehensive' ? 290 : 210;
    const monthly = perEmp * employees;
    const r = range(monthly, 0.2, 5, 100);
    return {
      period: 'month', ...r,
      headline: `Group benefits · ${employees} employees`,
      example: `${employees} employees in ${prov.name}, ${i.plan || 'standard'} plan design`,
      tiers: [
        tier('hsa', 'Health spending account', 'Most flexible', 110 * employees, ['Set annual budget per employee', 'Tax-efficient', 'No pooled premiums'], 'No medical questions'),
        tier('std', 'Core health & dental', 'Recommended', r.mid, ['Drugs, dental, paramedical', 'Life & AD&D', 'Optional LTD'], 'Employer census', true),
        tier('comp', 'Comprehensive + LTD', 'Best for retention', 290 * employees, ['Richer dental and vision', 'Long-term disability', 'EAP & virtual care'], 'Employer census'),
      ],
      notes: [], meta: { employees },
    };
  }
  const ind = INDUSTRY[i.industry] || INDUSTRY.consulting;
  const revenue = clamp(Number(i.revenue) || 250000, 10000, 50000000);
  const employees = clampInt(i.employees, 0, 1000, 1);
  const limitF = i.cgl_limit === '5m' ? 1.35 : i.cgl_limit === '1m' ? 0.85 : 1;
  const revF = Math.pow(revenue / 250000, 0.35);
  const empF = 1 + employees * 0.025;
  let annual = ind.cgl * limitF * revF * empF;
  if (product.slug === 'professional-liability-insurance' || i.need_eo === 'yes') annual += (ind.eo || 900) * revF;
  if (product.slug === 'contractor-insurance') annual = Math.max(annual, INDUSTRY.trades.cgl * limitF * revF * empF);
  const r = range(annual / 12, 0.25, 1, 30);
  return {
    period: 'month', ...r, annual: range(annual, 0.25, 10, 300),
    headline: `${product.short} · ${ind.label}`,
    example: `${ind.label} in ${prov.name}, ${money(revenue)} revenue, ${employees} employees, ${i.cgl_limit === '5m' ? '$5M' : i.cgl_limit === '1m' ? '$1M' : '$2M'} CGL`,
    tiers: [
      tier('cgl', 'CGL only', 'Lowest price', r.mid * 0.7, ['Third-party injury & property damage', 'Certificate of insurance', 'Products & completed operations'], 'Business details'),
      tier('pkg', 'Business package', 'Recommended', r.mid, ['CGL + contents/equipment', 'Business interruption', 'Crime & money coverage'], 'Business details', true),
      tier('pro', 'Package + E&O + cyber', 'Most protection', r.mid * 1.5, ['Professional liability (E&O)', 'Cyber & privacy breach', 'Higher limits'], 'Business details'),
    ],
    notes: [], meta: { industry: i.industry, revenue },
  };
}

function tier(key, name, label, mid, features, underwriting, featured = false) {
  return { key, name, label, monthly: Math.max(5, Math.round(mid * 100) / 100), features, underwriting, featured };
}

const MODELS = { life, health, travel, auto, property, business };

const providers = [
  {
    id: 'instasure-model',
    supports: () => true,
    quote(product, inputs) { return MODELS[product.quoteFlow](inputs, product); },
  },
];

/**
 * @returns {object} estimate { period, low, mid, high, headline, example, tiers[], notes[], asOf, provider, product, disclaimer }
 */
function estimate(productSlug, inputs = {}) {
  const product = bySlug[productSlug] || bySlug['life-insurance'];
  const provider = providers.find((p) => p.supports(product.quoteFlow, inputs));
  const out = provider.quote(product, inputs);
  out.product = product.slug;
  out.provider = provider.id;
  out.asOf = monthYear();
  out.periodLabel = out.period === 'month' ? '/mo' : out.period === 'year' ? '/yr' : ' per trip';
  return out;
}

/** "From $X/mo" for hero widgets with the default example profile (and its disclosure). */
const DEFAULT_PROFILES = {
  life: { age: 35, sex: 'female', smoker: 'no', coverage: 500000, term: 20, province: 'on' },
  health: { age: 35, sex: 'female', smoker: 'no', coverage: 100000, income: 80000, household: 'single', province: 'on' },
  travel: { age: 35, days: 14, visitor_age: 62, coverage: 100000, deductible: 0, province: 'on' },
  auto: { age: 40, years_licensed: 15, tickets: 0, claims: 0, vehicle_class: 'standard', province: 'on' },
  property: { province: 'on', contents: 30000, rebuild: 500000, year_built: 2000 },
  business: { industry: 'consulting', revenue: 150000, employees: 1, province: 'on' },
};
function fromPrice(productSlug, overrides = {}) {
  const p = bySlug[productSlug];
  if (!p) return null;
  const e = estimate(productSlug, { ...DEFAULT_PROFILES[p.quoteFlow], ...overrides });
  return { amount: e.low, periodLabel: e.periodLabel, example: e.example, asOf: e.asOf };
}

module.exports = { estimate, fromPrice, DEFAULT_PROFILES, INDUSTRY, providers };
