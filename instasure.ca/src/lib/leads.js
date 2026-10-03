'use strict';
/**
 * Lead service — the single entry point every form uses (quote flows, consult/booking,
 * calculators, guide downloads, newsletter, "save & continue later" partials).
 *
 * create(): validate → normalise → estimate → dedupe/merge partials → insert → score →
 *           route to a licensed advisor → enroll drips → transactional email → notifications.
 */
const db = require('../db');
const settings = require('./settings');
const scoring = require('./scoring');
const routing = require('./routing');
const drip = require('./drip');
const mailer = require('./mailer');
const quoteEngine = require('./quote-engine');
const config = require('../config');
const geo = require('../data/geo');
const { bySlug } = require('../data/products');
const specialties = require('./specialties');
const U = require('./util');

const LEAD_TYPES = ['quote', 'consult', 'calculator', 'guide', 'newsletter', 'partial'];
const STATUSES = ['new', 'contacted', 'quoted', 'application', 'won', 'lost', 'nurture', 'waitlist', 'junk'];
const TIMEFRAMES = ['now', '30d', '90d', 'researching'];

class LeadError extends Error { constructor(msg, field) { super(msg); this.field = field; this.status = 422; } }

function classifySource(ctx) {
  if (ctx.utm_medium) {
    const m = ctx.utm_medium.toLowerCase();
    if (/cpc|ppc|paid|ads/.test(m)) return 'paid';
    if (/email|newsletter/.test(m)) return 'email';
    if (/social/.test(m)) return 'social';
  }
  const host = (() => { try { return new URL(ctx.referrer).hostname; } catch { return ''; } })();
  if (!host) return 'direct';
  if (/(chatgpt|openai|perplexity|claude|anthropic|gemini|copilot|you\.com|phind)/.test(host)) return 'ai';
  if (/(google|bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu)\./.test(host)) return 'organic';
  if (/(facebook|instagram|linkedin|twitter|x\.com|tiktok|reddit|youtube|pinterest)/.test(host)) return 'social';
  if (host === new URL(config.siteUrl).hostname) return 'direct';
  return 'referral';
}

function normalise(input) {
  const service = specialties.isService(input.service) ? input.service : null;
  // A service request without a product quotes and routes through the service's parent product.
  const product = bySlug[input.product] ? input.product : service ? specialties.productFor(service) : null;
  const email = U.normEmail(input.email);
  const postal = U.normPostal(input.postal_code);
  let province = String(input.province || '').toLowerCase();
  if (!geo.provinceByCode[province]) province = geo.provinceFromPostal(postal) || null;
  let city = String(input.city || '').toLowerCase();
  if (city && !geo.cityByKey[`${province}/${city}`]) city = null;
  const lead_type = LEAD_TYPES.includes(input.lead_type) ? input.lead_type : 'quote';
  const qi = input.quote_inputs && typeof input.quote_inputs === 'object' ? input.quote_inputs : {};
  // keep quote inputs flat and bounded
  const quote_inputs = {};
  for (const [k, v] of Object.entries(qi).slice(0, 40)) if (/^[a-z_]{1,40}$/.test(k)) quote_inputs[k] = String(v).slice(0, 120);
  if (province) quote_inputs.province = province;
  if (city) quote_inputs.city = city;
  return {
    product, service, lead_type, email, province, city, postal_code: postal,
    product_category: product ? bySlug[product].category : null,
    first_name: U.truncate(input.first_name, 60) || null,
    last_name: U.truncate(input.last_name, 60) || null,
    phone: U.normPhone(input.phone) || (input.phone ? String(input.phone).slice(0, 30) : null),
    language: ['en', 'fr', 'pa', 'hi', 'zh', 'tl', 'ar', 'es', 'ur', 'ta', 'gu'].includes(input.language) ? input.language : 'en',
    timeframe: TIMEFRAMES.includes(input.timeframe) ? input.timeframe : null,
    best_time: U.truncate(input.best_time, 60) || null,
    message: U.truncate(input.message, 2000) || null,
    consent_marketing: input.consent_marketing === true || input.consent_marketing === 'on' || input.consent_marketing === 'yes' || input.consent_marketing === '1',
    quote_inputs,
  };
}

function validate(n) {
  if (!n.email || !U.isEmail(n.email)) throw new LeadError('Please enter a valid email address.', 'email');
  if (['consult'].includes(n.lead_type) && !n.phone && !n.first_name) throw new LeadError('Please add your name and a phone number so an advisor can reach you.', 'phone');
}

/**
 * @param {object} input  form payload
 * @param {object} ctx    { visitor_id, session_id, ip, ua, referrer, landing_page, page_path, utm_* }
 * @returns {Promise<object>} lead row
 */
async function create(input, ctx = {}) {
  const n = normalise(input);
  validate(n);
  const s = settings.all();
  const serviceable = !n.province || (s.serviceable_provinces || []).includes(n.province);
  const estimate = n.product && ['quote', 'calculator', 'partial'].includes(n.lead_type) ? quoteEngine.estimate(n.product, n.quote_inputs) : null;
  const consentText = n.consent_marketing ? settings.interpolate(s.consent_text) : null;
  const source = classifySource(ctx);

  // Dedupe: same email + product within the window. Partials are upgraded in place.
  const windowHours = Number(s.lead_dedupe_hours || 24);
  const recent = db.get(
    `SELECT * FROM leads WHERE email = ? AND COALESCE(product,'') = COALESCE(?, '') AND created_at >= datetime('now', ?) ORDER BY id DESC LIMIT 1`,
    [n.email, n.product, `-${windowHours} hours`],
  );

  let leadId;
  let upgraded = false;
  const row = {
    status: serviceable ? 'new' : 'waitlist',
    lead_type: n.lead_type,
    first_name: n.first_name, last_name: n.last_name, email: n.email, phone: n.phone,
    province: n.province, city: n.city, postal_code: n.postal_code, language: n.language,
    product: n.product, product_category: n.product_category, service: n.service,
    quote_inputs: n.quote_inputs, estimate: estimate || {},
    timeframe: n.timeframe, best_time: n.best_time, message: n.message,
    value_estimate: n.product ? bySlug[n.product].leadValue : 0,
    consent_marketing: n.consent_marketing ? 1 : 0, consent_text: consentText, consent_at: n.consent_marketing ? U.sqlNow() : null,
    page_path: U.truncate(ctx.page_path, 200),
    updated_at: U.sqlNow(),
  };

  if (recent && recent.lead_type === 'partial' && n.lead_type !== 'partial') {
    // Merge: keep the original attribution, fill in the completed data.
    const merged = { ...row };
    for (const k of Object.keys(merged)) if (merged[k] === null || merged[k] === undefined) delete merged[k];
    if (!n.consent_marketing && recent.consent_marketing) { delete merged.consent_marketing; delete merged.consent_text; delete merged.consent_at; }
    db.update('leads', recent.id, merged);
    leadId = recent.id;
    upgraded = true;
    db.insert('lead_events', { lead_id: leadId, type: 'partial_completed', data: { lead_type: n.lead_type } });
  } else {
    leadId = db.insert('leads', {
      ...row,
      ref: U.leadRef(),
      source, utm_source: ctx.utm_source, utm_medium: ctx.utm_medium, utm_campaign: ctx.utm_campaign, utm_term: ctx.utm_term, utm_content: ctx.utm_content,
      landing_page: U.truncate(ctx.landing_page, 200), referrer: U.truncate(ctx.referrer, 300),
      visitor_id: ctx.visitor_id, session_id: ctx.session_id, ip_hash: U.hashIp(ctx.ip, config.trackingSecret), user_agent: U.truncate(ctx.ua, 300),
      duplicate_of: recent ? recent.id : null,
      is_test: /(\+test|@example\.(com|org)|@instasure\.test)$/i.test(n.email) ? 1 : 0,
    });
    db.insert('lead_events', { lead_id: leadId, type: 'created', data: { lead_type: n.lead_type, product: n.product, source, page: ctx.page_path } });
  }

  if (n.consent_marketing) db.run('DELETE FROM suppressions WHERE email = ?', [n.email]);
  scoring.rescore(leadId, upgraded ? 'partial completed' : 'created');
  let lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);

  if (serviceable && !lead.advisor_id && n.lead_type !== 'newsletter' && n.lead_type !== 'partial') routing.assign(lead);
  lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);

  if (n.lead_type === 'partial') drip.enroll(lead, 'quote_abandoned');
  else if (!lead.duplicate_of) drip.enroll(lead, 'lead_created');

  db.insert('events', { name: 'lead', path: ctx.page_path, visitor_id: ctx.visitor_id, session_id: ctx.session_id, data: { ref: lead.ref, product: lead.product, type: lead.lead_type, score: lead.score } });

  // Transactional confirmation (CASL: a requested quote/estimate is exempt from consent; still identified + unsubscribable).
  if (!lead.is_test || process.env.NODE_ENV === 'test') {
    sendConfirmation(lead).catch((e) => console.error('[leads] confirmation failed', e));
    notifyTeam(lead).catch((e) => console.error('[leads] notify failed', e));
  }
  return lead;
}

async function sendConfirmation(lead) {
  if (lead.lead_type === 'newsletter') return;
  const product = bySlug[lead.product];
  const est = db.json(lead.estimate, {});
  const waitlist = lead.status === 'waitlist';
  const lines = [];
  lines.push(`Hi {{first_name}},`);
  if (lead.lead_type === 'partial') {
    lines.push(`Here’s your saved ${product ? product.name.toLowerCase() : 'insurance'} quote. Pick up where you left off any time — your answers are saved under reference **{{ref}}**.`);
  } else if (waitlist) {
    lines.push(settings.get('waitlist_message'));
  } else {
    lines.push(`Thanks for using ${settings.get('site_name')}. Your reference is **{{ref}}**.`);
    if (est.low !== undefined) lines.push(`Your instant estimate for **${est.headline || product.name}** is **{{estimate_low}}–{{estimate_high}}{{estimate_period}}** (example profile: ${est.example}). Estimates are not quotes — your advisor will confirm real insurer prices.`);
    const desk = lead.service && specialties.deskBySlug[lead.service];
    if (desk) lines.push(`Your request went to our **${desk.desk}**, which handles ${desk.name.toLowerCase()} requests.`);
    lines.push(lead.advisor_id ? `**{{advisor_name}}**, a licensed advisor in {{province_name}}, will review your request${settings.get('advisor_response_hours') ? ` — usually within ${settings.get('advisor_response_hours')} business hours` : ''}. Want to pick a time? [Book a call]({{advisor_booking_url}}).` : 'A licensed advisor will review your request and follow up shortly.');
  }
  await mailer.sendEmail({
    lead, kind: 'transactional',
    subject: lead.lead_type === 'partial' ? 'Your saved quote ({{ref}})' : waitlist ? 'You’re on the list ({{ref}})' : 'Your {{product_short}} estimate ({{ref}})',
    preheader: est.low !== undefined ? 'Estimate {{estimate_low}}–{{estimate_high}}{{estimate_period}}' : 'We received your request',
    bodyMd: lines.join('\n\n'),
    ctaLabel: lead.lead_type === 'partial' ? 'Resume my quote' : 'View my results',
    ctaUrl: lead.lead_type === 'partial' && product ? `${config.siteUrl}/quote/${product.slug}/?resume=${lead.ref}` : '{{quote_url}}',
  });
}

async function notifyTeam(lead) {
  if (lead.lead_type === 'partial' || lead.lead_type === 'newsletter') return;
  const s = settings.all();
  const hot = lead.score >= Number(s.hot_lead_threshold || 75);
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const to = new Set();
  if (advisor && advisor.email && !advisor.is_demo) to.add(advisor.email);
  if (hot || !advisor) for (const e of s.notify_emails || []) to.add(e);
  const product = bySlug[lead.product];
  for (const addr of to) {
    await mailer.sendEmail({
      lead, to: addr, kind: 'notification', track: false,
      subject: `${hot ? '🔥 HOT ' : ''}New ${product ? product.short : ''} lead ${lead.ref} — score ${lead.score} (${lead.grade})`,
      bodyMd: [
        `**${lead.first_name || ''} ${lead.last_name || ''}** · ${lead.email}${lead.phone ? ' · ' + U.fmtPhone(lead.phone) : ''}`,
        `Product: **${product ? product.name : '—'}**${lead.service ? ` · Service: **${specialties.labelFor(lead.service)}**${specialties.deskBySlug[lead.service] ? ` (${specialties.deskBySlug[lead.service].desk})` : ''}` : ''} · ${lead.city || ''} ${String(lead.province || '').toUpperCase()} · Type: ${lead.lead_type} · Timeframe: ${lead.timeframe || '—'}`,
        `Assigned to: ${advisor ? advisor.name : '**Unassigned — needs routing**'} · Status: ${lead.status}`,
        `[Open in CRM](${config.siteUrl}/admin/leads/${lead.id})`,
      ].join('\n\n'),
    });
  }
}

function setStatus(leadId, status, { userId, reason } = {}) {
  if (!STATUSES.includes(status)) throw new LeadError('Invalid status');
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead || lead.status === status) return lead;
  const patch = { status, updated_at: U.sqlNow() };
  if (status === 'contacted' && !lead.contacted_at) patch.contacted_at = U.sqlNow();
  if (status === 'won') patch.won_at = U.sqlNow();
  if (status === 'lost') patch.lost_reason = reason || null;
  db.update('leads', leadId, patch);
  db.insert('lead_events', { lead_id: leadId, type: 'status_change', user_id: userId, data: { from: lead.status, to: status, reason } });
  const updated = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  drip.enroll(updated, 'status_changed');
  return updated;
}

function unsubscribe(lead, reason = 'user request') {
  db.tx(() => {
    db.run('UPDATE leads SET unsubscribed_at = CURRENT_TIMESTAMP, consent_marketing = 0 WHERE email = ?', [lead.email]);
    db.run('INSERT OR IGNORE INTO suppressions(email, reason) VALUES (?, ?)', [lead.email.toLowerCase(), reason]);
    for (const l of db.all('SELECT id FROM leads WHERE email = ?', [lead.email])) {
      drip.stopEnrollments(l.id, 'unsubscribed', 'unsubscribed');
      db.insert('lead_events', { lead_id: l.id, type: 'unsubscribed', data: { reason } });
    }
  });
}

module.exports = { create, setStatus, unsubscribe, classifySource, normalise, LeadError, LEAD_TYPES, STATUSES, TIMEFRAMES };
