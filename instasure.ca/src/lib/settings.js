'use strict';
/**
 * Site settings (key/value in SQLite) with typed defaults and an in-memory cache.
 * Trust claims (ratings, carrier names, licence numbers) default to EMPTY so the public site
 * never shows unverifiable claims — fill them in Admin → Site settings once they are true.
 */
const db = require('../db');

const DEFAULTS = {
  site_name: 'Instasure.ca',
  legal_name: '',
  tagline: 'Instant insurance answers, instant quotes and licensed advisors across Canada.',
  phone: '',
  email: 'hello@instasure.ca',
  mailing_address: '',
  privacy_officer: '',
  founded_year: '2026',
  licence_disclosure:
    'Instasure.ca provides insurance information and estimates and connects Canadians with insurance professionals licensed in their province. Estimates are not quotes, offers or guarantees of coverage; final terms and pricing are set by the insurer after underwriting.',
  quote_disclaimer:
    'Estimates are indicative ranges based on typical Canadian pricing for the example profile shown. They are not an offer of insurance. A licensed advisor confirms actual insurer quotes.',
  serviceable_provinces: ['on', 'bc', 'ab', 'mb', 'sk', 'ns', 'nb', 'nl', 'pe'],
  waitlist_message: 'We’re not yet licensed to advise in your province. Join the waitlist and we’ll contact you as soon as a licensed advisor is available.',
  rating_value: '',
  rating_count: '',
  rating_source: '',
  carriers: ['Canada Life', 'Manulife', 'Sun Life', 'Desjardins', 'iA Financial Group', 'RBC Insurance', 'BMO Insurance', 'Equitable Life', 'Beneva', 'Wawanesa', 'Intact', 'Aviva'],
  carriers_confirmed: false,
  social_links: [],
  ga4_id: '',
  gsc_verification: '',
  bing_verification: '',
  indexnow_key: '',
  ai_bot_policy: 'allow_all', // allow_all | search_only | block_all
  robots_extra: '',
  casl_mode: 'express_only', // express_only | express_or_implied
  consent_text: 'Yes, email me my quote summary, reminders and helpful insurance information from {site_name}. I can unsubscribe at any time.',
  sms_consent_text: 'Yes, you may text me about my request. Message & data rates may apply. Reply STOP to opt out.',
  from_name: 'Instasure.ca',
  from_email: 'hello@instasure.ca',
  reply_to: '',
  notify_emails: ['leads@instasure.ca'],
  hot_lead_threshold: 75,
  lead_dedupe_hours: 24,
  quiet_hours: { start: 8, end: 20 },
  announcement: '',
  default_og_image: '/img/og-default.png',
  advisor_response_hours: 2,
  instant_policy_products: [],
  analytics_cookie_banner: true,
  french_enabled: false,
};

let cache = null;

function load() {
  cache = { ...DEFAULTS };
  for (const row of db.all('SELECT key, value FROM settings')) {
    try { cache[row.key] = JSON.parse(row.value); } catch { cache[row.key] = row.value; }
  }
  return cache;
}

function all() { return cache || load(); }
function get(key, fallback) { const v = all()[key]; return v === undefined ? fallback : v; }
function set(key, value) {
  db.run('INSERT INTO settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP', [key, JSON.stringify(value)]);
  if (cache) cache[key] = value;
}
function setMany(obj) { db.tx(() => { for (const [k, v] of Object.entries(obj)) set(k, v); }); }
function invalidate() { cache = null; }

/** Interpolate {site_name}-style tokens with settings values. */
function interpolate(str) { return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (all()[k] !== undefined ? String(all()[k]) : m)); }

module.exports = { DEFAULTS, all, get, set, setMany, invalidate, interpolate };
