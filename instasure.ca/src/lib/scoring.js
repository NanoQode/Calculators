'use strict';
/**
 * Rules-based lead scoring (0–100) with an explainable breakdown.
 * Rules live in `scoring_rules` (editable in Admin → Scoring) and evaluate against a flat
 * "facts" object derived from the lead, its quote inputs, site engagement and email engagement.
 * Leads are re-scored on creation, on email opens/clicks, on return visits and on edits.
 */
const db = require('../db');
const settings = require('./settings');
const { bySlug } = require('../data/products');
const { isEmail, isDisposable, normPhone } = require('./util');

const OPERATORS = {
  eq: (a, b) => String(a) === String(b),
  neq: (a, b) => String(a) !== String(b),
  in: (a, b) => String(b).split(',').map((s) => s.trim()).includes(String(a)),
  nin: (a, b) => !String(b).split(',').map((s) => s.trim()).includes(String(a)),
  gte: (a, b) => a !== null && a !== undefined && a !== '' && Number(a) >= Number(b),
  lte: (a, b) => a !== null && a !== undefined && a !== '' && Number(a) <= Number(b),
  between: (a, b) => { const [lo, hi] = String(b).split(',').map(Number); return a !== null && a !== undefined && a !== '' && Number(a) >= lo && Number(a) <= hi; },
  exists: (a) => a !== null && a !== undefined && a !== '' && a !== false && a !== 0,
  missing: (a) => a === null || a === undefined || a === '' || a === false || a === 0,
  contains: (a, b) => String(a || '').toLowerCase().includes(String(b).toLowerCase()),
  regex: (a, b) => { try { return new RegExp(b, 'i').test(String(a || '')); } catch { return false; } },
};

const FIELDS = [
  ['lead_type', 'Lead type (quote, consult, calculator, guide, newsletter, partial, waitlist)'],
  ['product', 'Product slug'], ['product_category', 'Product category (life, health, travel, auto, property, business)'],
  ['lead_value', 'Product lead value ($)'], ['province', 'Province code'], ['city', 'City slug'],
  ['serviceable', 'Province is serviceable (true/false)'], ['coverage', 'Requested coverage amount'], ['age', 'Applicant age'],
  ['smoker', 'Smoker (yes/no)'], ['timeframe', 'Timeframe (now, 30d, 90d, researching)'], ['wants_call', 'Asked for a call (true/false)'],
  ['has_phone', 'Valid phone provided'], ['has_name', 'First and last name provided'], ['email_valid', 'Email is valid'],
  ['email_disposable', 'Disposable email domain'], ['consent_marketing', 'Express marketing consent'], ['is_test', 'Marked as test'],
  ['is_duplicate', 'Duplicate of a recent lead'], ['sessions', 'Site sessions by this visitor'], ['pages_viewed', 'Pages viewed by this visitor'],
  ['email_opens', 'Email opens'], ['email_clicks', 'Email clicks'], ['source', 'Traffic source (organic, paid, direct, referral, email, social, ai)'],
  ['utm_campaign', 'UTM campaign'], ['landing_page', 'Landing page path'],
];

let rulesCache = null;
function rules() {
  if (!rulesCache) rulesCache = db.all('SELECT * FROM scoring_rules WHERE active = 1 ORDER BY sort, id');
  return rulesCache;
}
function invalidate() { rulesCache = null; }

function buildFacts(lead, extra = {}) {
  const inputs = typeof lead.quote_inputs === 'string' ? db.json(lead.quote_inputs, {}) : lead.quote_inputs || {};
  const product = bySlug[lead.product] || {};
  const serviceable = (settings.get('serviceable_provinces') || []).includes(String(lead.province || '').toLowerCase());
  return {
    lead_type: lead.lead_type,
    product: lead.product,
    product_category: lead.product_category || product.category,
    lead_value: product.leadValue || 0,
    province: lead.province,
    city: lead.city,
    serviceable,
    coverage: Number(inputs.coverage) || null,
    age: Number(inputs.age) || null,
    smoker: inputs.smoker || null,
    timeframe: lead.timeframe || inputs.timeframe || null,
    wants_call: !!(lead.best_time || lead.lead_type === 'consult' || inputs.wants_call === 'yes'),
    has_phone: !!normPhone(lead.phone),
    has_name: !!(lead.first_name && lead.last_name),
    email_valid: isEmail(lead.email),
    email_disposable: isDisposable(lead.email),
    consent_marketing: !!lead.consent_marketing,
    is_test: !!lead.is_test,
    is_duplicate: !!lead.duplicate_of,
    sessions: extra.sessions || 0,
    pages_viewed: extra.pages_viewed || 0,
    email_opens: extra.email_opens || 0,
    email_clicks: extra.email_clicks || 0,
    source: lead.source,
    utm_campaign: lead.utm_campaign,
    landing_page: lead.landing_page,
  };
}

function gradeFor(score) {
  const hot = Number(settings.get('hot_lead_threshold', 75));
  return score >= hot ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
}

function evaluate(facts, ruleList = rules()) {
  let score = 0;
  const breakdown = [];
  for (const r of ruleList) {
    const op = OPERATORS[r.operator];
    if (!op) continue;
    if (op(facts[r.field], r.value)) {
      score += r.points;
      breakdown.push({ id: r.id, name: r.name, category: r.category, points: r.points });
    }
  }
  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFor(score), breakdown };
}

function engagementFor(lead) {
  const out = { sessions: 0, pages_viewed: 0, email_opens: 0, email_clicks: 0 };
  if (lead.visitor_id) {
    const r = db.get('SELECT COUNT(DISTINCT session_id) s, COUNT(*) p FROM pageviews WHERE visitor_id = ?', [lead.visitor_id]);
    out.sessions = r.s; out.pages_viewed = r.p;
  }
  const e = db.get('SELECT COALESCE(SUM(open_count),0) o, COALESCE(SUM(click_count),0) c FROM emails WHERE lead_id = ?', [lead.id]);
  out.email_opens = e.o; out.email_clicks = e.c;
  return out;
}

/** Recompute and persist a lead's score; logs a score_change event when it moves. */
function rescore(leadId, reason = 'recalculated') {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead) return null;
  const result = evaluate(buildFacts(lead, engagementFor(lead)));
  if (result.score !== lead.score || !lead.grade) {
    db.update('leads', leadId, { score: result.score, grade: result.grade, score_breakdown: result.breakdown, updated_at: new Date().toISOString() });
    db.insert('lead_events', { lead_id: leadId, type: 'score_change', data: { from: lead.score, to: result.score, grade: result.grade, reason } });
  }
  return result;
}

const DEFAULT_RULES = [
  // fit
  ['High-value product (≥ $300 lead value)', 'fit', 'lead_value', 'gte', '300', 15],
  ['Mid-value product ($100–$299)', 'fit', 'lead_value', 'between', '100,299', 8],
  ['Coverage ≥ $500k', 'fit', 'coverage', 'gte', '500000', 8],
  ['Coverage ≥ $1M', 'fit', 'coverage', 'gte', '1000000', 5],
  ['Age 25–55 (core life/health buyer)', 'fit', 'age', 'between', '25,55', 5],
  ['Serviceable province', 'fit', 'serviceable', 'eq', 'true', 10],
  ['Province not serviceable yet', 'fit', 'serviceable', 'eq', 'false', -30],
  // intent
  ['Completed instant quote', 'intent', 'lead_type', 'eq', 'quote', 20],
  ['Requested advisor consultation', 'intent', 'lead_type', 'eq', 'consult', 25],
  ['Calculator result request', 'intent', 'lead_type', 'eq', 'calculator', 8],
  ['Guide / newsletter sign-up', 'intent', 'lead_type', 'in', 'guide,newsletter', 3],
  ['Needs coverage within 30 days', 'intent', 'timeframe', 'in', 'now,30d', 15],
  ['Just researching', 'intent', 'timeframe', 'eq', 'researching', -5],
  ['Asked for a call', 'intent', 'wants_call', 'eq', 'true', 8],
  // quality
  ['Valid phone number', 'quality', 'has_phone', 'eq', 'true', 12],
  ['Full name provided', 'quality', 'has_name', 'eq', 'true', 4],
  ['Disposable email domain', 'quality', 'email_disposable', 'eq', 'true', -25],
  ['Invalid email', 'quality', 'email_valid', 'eq', 'false', -40],
  ['Duplicate of a recent lead', 'quality', 'is_duplicate', 'eq', 'true', -15],
  ['Test lead', 'quality', 'is_test', 'eq', 'true', -100],
  // engagement
  ['Returning visitor (2+ sessions)', 'engagement', 'sessions', 'gte', '2', 5],
  ['Viewed 5+ pages', 'engagement', 'pages_viewed', 'gte', '5', 5],
  ['Opened an email', 'engagement', 'email_opens', 'gte', '1', 3],
  ['Clicked an email', 'engagement', 'email_clicks', 'gte', '1', 8],
  ['Organic search visitor', 'engagement', 'source', 'eq', 'organic', 3],
  ['Arrived from an AI assistant', 'engagement', 'source', 'eq', 'ai', 4],
];

module.exports = { OPERATORS, FIELDS, DEFAULT_RULES, rules, invalidate, buildFacts, evaluate, rescore, gradeFor, engagementFor };
