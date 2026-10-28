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
  // Customer service line. Ships as an obviously invalid placeholder (no 000 exchange exists in North America),
  // shown so the layout is complete; it is kept out of structured data and flagged in the admin launch checklist.
  phone: '1-800-000-0000',
  phone_hours: 'Monday to Friday, 9 a.m. to 6 p.m. ET',
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
  provider_scroller: true, // home page logo scroller under the hero (Admin → Insurers & MGAs)
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
  lead_dedupe_hours: 24, // legacy: repeat submissions now update the existing lead (see lead_merge_days)
  // Repeat submissions from the same person update their existing lead instead of creating a new one.
  lead_match_phone: true, // also treat the same mobile number as the same person
  lead_merge_days: 0,     // only merge into leads active in the last N days (0 = any time)
  // Lead distribution (Admin → Lead distribution)
  assignment_mode: 'best_match', // round_robin | best_match | manual
  assignment_rules: [],          // [{ province, category, service, advisor_id }] tried first, in order
  default_monthly_cap: 50,       // monthly lead cap given to newly registered agents (blank on an agent = no limit)
  agent_registration_open: true, // /admin/register accepts new agent sign-ups
  require_note_on_new: true,     // an agent who opens a new lead must add a note to it before opening another
  // SMS one-time codes (VoIP.ms). Enforced only when enabled AND the provider is configured.
  otp_enabled: false,
  otp_length: 6,
  otp_ttl_minutes: 10,
  otp_max_attempts: 5,
  otp_resend_seconds: 30,
  otp_max_sends: 5,
  otp_message: '{code} is your {site_name} verification code. It expires in {minutes} minutes.',
  sms_provider: 'voipms', // voipms (or 'log' outside production: records instead of sending)
  voipms_username: '',
  voipms_did: '',
  // Daily lead report for agent managers (and anyone with "daily report" ticked)
  daily_report_hour: 7, // Toronto time
  daily_report_last: '',
  report_extra_emails: [],
  task_email_reminders: true,
  quiet_hours: { start: 8, end: 20 },
  announcement: '',
  default_og_image: '/img/og-default.png',
  advisor_response_hours: 2,
  instant_policy_products: [],
  // Date the estimate model and programmatic page data were last reviewed. Drives "as of" lines, dateModified and sitemap lastmod.
  estimates_reviewed_at: '2026-10-03',
  analytics_cookie_banner: true,
  french_enabled: false,
};

const PLACEHOLDER_PHONE = '1-800-000-0000';
/** True while the customer service number is still the shipped placeholder (or empty). */
function phoneIsPlaceholder(v) { const d = String(v || '').replace(/\D/g, ''); return !d || d === '18000000000' || /^1?\d{3}0{7}$/.test(d); }

/** Secrets are stored like any setting but never enter the cache that views receive as `s`. */
const SECRET_KEYS = new Set(['voipms_password']);

let cache = null;

function load() {
  cache = { ...DEFAULTS };
  for (const row of db.all('SELECT key, value FROM settings')) {
    if (SECRET_KEYS.has(row.key)) continue;
    try { cache[row.key] = JSON.parse(row.value); } catch { cache[row.key] = row.value; }
  }
  return cache;
}
function secret(key) {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return '';
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function all() { return cache || load(); }
function get(key, fallback) { const v = all()[key]; return v === undefined ? fallback : v; }
function set(key, value) {
  db.run('INSERT INTO settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP', [key, JSON.stringify(value)]);
  if (cache && !SECRET_KEYS.has(key)) cache[key] = value;
}
function setMany(obj) { db.tx(() => { for (const [k, v] of Object.entries(obj)) set(k, v); }); }
function invalidate() { cache = null; }

/** Interpolate {site_name}-style tokens with settings values. */
function interpolate(str) { return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (all()[k] !== undefined ? String(all()[k]) : m)); }

module.exports = { DEFAULTS, PLACEHOLDER_PHONE, phoneIsPlaceholder, all, get, set, setMany, secret, invalidate, interpolate };
