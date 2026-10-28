'use strict';
/**
 * Lead service — the single entry point every form uses (quote flows, consult/booking,
 * calculators, guide downloads, newsletter, "save & continue later" partials).
 *
 * create(): validate → normalise → estimate → find this person's existing lead (same email, or the
 *           same mobile number) → update it and record the request as an inquiry, or insert a new
 *           lead → score → route to a licensed agent → drips → confirmation email → notifications.
 * One person = one lead. Every request (the first included) is a row in lead_inquiries, so a
 * second product question is noted on the same record instead of creating a duplicate.
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
const stages = require('./stages');
const U = require('./util');

const LEAD_TYPES = ['quote', 'consult', 'calculator', 'guide', 'newsletter', 'partial'];
/** A later request can upgrade the lead type (a saved partial that becomes a full quote, a guide reader who books a call). */
const TYPE_RANK = { partial: 0, newsletter: 1, guide: 2, calculator: 3, quote: 4, consult: 5 };
const STATUSES = stages.KEYS;
const TIMEFRAMES = ['now', '30d', '90d', 'researching'];
const ANONYMISED = "email LIKE 'deleted-%@invalid'";

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

/** Normalise and validate without saving (the SMS-code step checks a submission before texting a code). */
function check(input) { const n = normalise(input); validate(n); return n; }

/** This person's most recent lead: same email first, then (optionally) the same valid mobile number. */
function findExisting(n) {
  const s = settings.all();
  const days = Number(s.lead_merge_days) || 0;
  const recent = days ? ` AND COALESCE(last_activity_at, updated_at, created_at) >= datetime('now', '-${days} days')` : '';
  let row = db.get(`SELECT * FROM leads WHERE email = ? AND NOT ${ANONYMISED}${recent} ORDER BY id DESC LIMIT 1`, [n.email]);
  if (!row && s.lead_match_phone !== false && U.normPhone(n.phone)) {
    // A shared household number isn't the same person: different first names never match on phone alone.
    row = db.all(`SELECT * FROM leads WHERE phone = ? AND NOT ${ANONYMISED}${recent} ORDER BY id DESC LIMIT 10`, [U.normPhone(n.phone)])
      .find((l) => sameName(l.first_name, n.first_name)) || null;
  }
  return row || null;
}
const nameKey = (v) => String(v || '').trim().toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
/** First names are compatible when either is blank or they match. */
function sameName(a, b) { const x = nameKey(a), y = nameKey(b); return !x || !y || x === y; }

function productsOf(lead) {
  const list = db.json(lead.products, []);
  if (lead.product && !list.includes(lead.product)) list.unshift(lead.product);
  return list;
}
const valueOf = (products) => products.reduce((sum, p) => sum + ((bySlug[p] && bySlug[p].leadValue) || 0), 0);

function recordInquiry(leadId, n, { estimate, ctx = {}, source, origin = 'submission', isNewProduct = false, ref = null, createdAt } = {}) {
  return db.insert('lead_inquiries', {
    lead_id: leadId, ref, origin, lead_type: n.lead_type, product: n.product, product_category: n.product_category, service: n.service,
    is_new_product: isNewProduct ? 1 : 0, quote_inputs: n.quote_inputs || {}, estimate: estimate || {}, timeframe: n.timeframe, message: n.message,
    source, utm_source: ctx.utm_source, utm_medium: ctx.utm_medium, utm_campaign: ctx.utm_campaign,
    landing_page: U.truncate(ctx.landing_page, 200) || null, page_path: U.truncate(ctx.page_path, 200) || null, created_at: createdAt,
  });
}

/**
 * Update an existing lead with a repeat request. Contact details fill blanks (a completed quote
 * replaces a saved partial's answers), the same product refreshes the quote, another product is
 * added to the record, consent is never downgraded, and a closed lead that comes back re-opens.
 */
function applyRepeat(existing, n, { estimate, serviceable, phoneVerified }) {
  const now = U.sqlNow();
  const patch = { updated_at: now, last_activity_at: now, inquiry_count: (Number(existing.inquiry_count) || 1) + 1 };
  const upgradingPartial = existing.lead_type === 'partial' && n.lead_type !== 'partial';
  for (const k of ['first_name', 'last_name', 'phone', 'province', 'city', 'postal_code', 'language', 'timeframe', 'best_time']) {
    if (n[k] && (!existing[k] || upgradingPartial)) patch[k] = n[k];
  }
  if (phoneVerified && U.normPhone(n.phone)) { patch.phone = U.normPhone(n.phone); patch.phone_verified_at = now; }
  if (n.message) patch.message = n.message;
  if ((TYPE_RANK[n.lead_type] || 0) > (TYPE_RANK[existing.lead_type] || 0)) patch.lead_type = n.lead_type;

  const products = productsOf(existing);
  let newProduct = false;
  if (n.product) {
    if (!existing.product) {
      Object.assign(patch, { product: n.product, product_category: n.product_category, service: n.service, quote_inputs: n.quote_inputs, estimate: estimate || {} });
    } else if (existing.product === n.product) {
      if (Object.keys(n.quote_inputs).length) patch.quote_inputs = n.quote_inputs;
      if (estimate) patch.estimate = estimate;
      if (n.service && !existing.service) patch.service = n.service;
    } else if (!products.includes(n.product)) newProduct = true;
    if (!products.includes(n.product)) products.push(n.product);
  }
  patch.products = products;
  patch.value_estimate = valueOf(products);

  if (n.consent_marketing) {
    Object.assign(patch, { consent_marketing: 1, consent_text: settings.interpolate(settings.get('consent_text')), consent_at: now, unsubscribed_at: null });
  }
  db.update('leads', existing.id, patch);

  let reopen = null;
  if (!['partial', 'newsletter'].includes(n.lead_type)) {
    if (['lost', 'nurture'].includes(existing.status)) reopen = 'new';
    if (existing.status === 'waitlist' && serviceable) reopen = 'new';
  }
  return { newProduct, reopen, upgradingPartial };
}

/**
 * @param {object} input  form payload
 * @param {object} ctx    { visitor_id, session_id, ip, ua, referrer, landing_page, page_path, utm_* }
 * @param {object} opts   { phoneVerified: true when the number was confirmed by SMS code }
 * @returns {Promise<object>} lead row, with `repeat` and `newProduct` flags when an existing lead was updated
 */
async function create(input, ctx = {}, opts = {}) {
  const n = normalise(input);
  validate(n);
  const s = settings.all();
  const estimate = n.product && ['quote', 'calculator', 'partial'].includes(n.lead_type) ? quoteEngine.estimate(n.product, n.quote_inputs) : null;
  const source = classifySource(ctx);
  const existing = findExisting(n);
  const province = (existing && existing.province) || n.province;
  const serviceable = !province || (s.serviceable_provinces || []).includes(province);

  let leadId;
  let repeat = null;
  if (existing) {
    repeat = applyRepeat(existing, n, { estimate, serviceable, phoneVerified: opts.phoneVerified });
    leadId = existing.id;
    recordInquiry(leadId, n, { estimate, ctx, source, origin: 'repeat', isNewProduct: repeat.newProduct });
    db.insert('lead_events', { lead_id: leadId, type: repeat.upgradingPartial ? 'partial_completed' : 'repeat_inquiry', data: {
      lead_type: n.lead_type, product: n.product, new_product: repeat.newProduct || undefined, page: ctx.page_path,
      note: repeat.newProduct ? `Also asked about ${(bySlug[n.product] || {}).name || n.product}` : undefined,
    } });
    if (repeat.reopen) setStatus(leadId, repeat.reopen, { reason: 'Came back with a new request' });
  } else {
    const consentText = n.consent_marketing ? settings.interpolate(s.consent_text) : null;
    const now = U.sqlNow();
    leadId = db.insert('leads', {
      status: serviceable ? 'new' : 'waitlist',
      lead_type: n.lead_type,
      first_name: n.first_name, last_name: n.last_name, email: n.email, phone: n.phone,
      province: n.province, city: n.city, postal_code: n.postal_code, language: n.language,
      product: n.product, product_category: n.product_category, service: n.service, products: n.product ? [n.product] : [],
      quote_inputs: n.quote_inputs, estimate: estimate || {},
      timeframe: n.timeframe, best_time: n.best_time, message: n.message,
      value_estimate: n.product ? bySlug[n.product].leadValue : 0,
      consent_marketing: n.consent_marketing ? 1 : 0, consent_text: consentText, consent_at: n.consent_marketing ? now : null,
      phone_verified_at: opts.phoneVerified && U.normPhone(n.phone) ? now : null,
      ref: U.leadRef(),
      source, utm_source: ctx.utm_source, utm_medium: ctx.utm_medium, utm_campaign: ctx.utm_campaign, utm_term: ctx.utm_term, utm_content: ctx.utm_content,
      landing_page: U.truncate(ctx.landing_page, 200), referrer: U.truncate(ctx.referrer, 300), page_path: U.truncate(ctx.page_path, 200),
      visitor_id: ctx.visitor_id, session_id: ctx.session_id, ip_hash: U.hashIp(ctx.ip, config.trackingSecret), user_agent: U.truncate(ctx.ua, 300),
      is_test: /(\+test|@example\.(com|org)|@instasure\.test)$/i.test(n.email) ? 1 : 0,
      last_activity_at: now, updated_at: now,
    });
    recordInquiry(leadId, n, { estimate, ctx, source });
    db.insert('lead_events', { lead_id: leadId, type: 'created', data: { lead_type: n.lead_type, product: n.product, source, page: ctx.page_path, phone_verified: opts.phoneVerified || undefined } });
  }

  if (n.consent_marketing) db.run('DELETE FROM suppressions WHERE email = ?', [n.email]);
  scoring.rescore(leadId, repeat ? 'new request' : 'created');
  let lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);

  const routable = lead.lead_type !== 'newsletter' && lead.lead_type !== 'partial';
  if (serviceable && !lead.advisor_id && routable) {
    routing.assign(lead);
    lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  }

  if (lead.lead_type === 'partial') drip.enroll(lead, 'quote_abandoned');
  else drip.enroll(lead, 'lead_created'); // one enrolment per campaign per person, so a repeat never restarts a sequence

  db.insert('events', { name: 'lead', path: ctx.page_path, visitor_id: ctx.visitor_id, session_id: ctx.session_id, data: { ref: lead.ref, product: n.product, type: n.lead_type, score: lead.score, repeat: !!repeat } });

  // Transactional confirmation (CASL: a requested quote/estimate is exempt from consent; still identified + unsubscribable).
  if (!lead.is_test || process.env.NODE_ENV === 'test') {
    const forProduct = n.product || lead.product;
    sendConfirmation({ ...lead, product: forProduct, estimate: estimate || lead.estimate, lead_type: n.lead_type }).catch((e) => console.error('[leads] confirmation failed', e));
    notifyTeam(lead, { repeat: !!repeat, newProduct: repeat && repeat.newProduct ? n.product : null }).catch((e) => console.error('[leads] notify failed', e));
  }
  return { ...lead, repeat: !!repeat, newProduct: !!(repeat && repeat.newProduct) };
}

async function sendConfirmation(lead) {
  if (lead.lead_type === 'newsletter') return;
  const product = bySlug[lead.product];
  const est = db.json(lead.estimate, {});
  const waitlist = lead.status === 'waitlist';
  const lines = [];
  lines.push('Hi {{first_name}},');
  if (lead.lead_type === 'partial') {
    lines.push(`Here’s your saved ${product ? product.name.toLowerCase() : 'insurance'} quote. Pick up where you left off any time — your answers are saved under reference **{{ref}}**.`);
  } else if (waitlist) {
    lines.push(settings.get('waitlist_message'));
  } else {
    lines.push(`Thanks for using ${settings.get('site_name')}. Your reference is **{{ref}}**.`);
    if (est.low !== undefined && product) lines.push(`Your instant estimate for **${est.headline || product.name}** is **{{estimate_low}}–{{estimate_high}}{{estimate_period}}** (example profile: ${est.example}). Estimates are not quotes — your advisor will confirm real insurer prices.`);
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

function leadSummaryMd(lead) {
  const product = bySlug[lead.product];
  const others = productsOf(lead).filter((p) => p !== lead.product).map((p) => (bySlug[p] || {}).short || p);
  return [
    `**${lead.first_name || ''} ${lead.last_name || ''}** · ${lead.email}${lead.phone ? ' · ' + U.fmtPhone(lead.phone) : ''}${lead.phone_verified_at ? ' (verified by SMS)' : ''}`,
    `Product: **${product ? product.name : '—'}**${others.length ? ` · also asked about: ${others.join(', ')}` : ''}${lead.service ? ` · Service: **${specialties.labelFor(lead.service)}**${specialties.deskBySlug[lead.service] ? ` (${specialties.deskBySlug[lead.service].desk})` : ''}` : ''} · ${lead.city || ''} ${String(lead.province || '').toUpperCase()} · Type: ${lead.lead_type} · Timeframe: ${lead.timeframe || '—'}`,
  ];
}

async function notifyTeam(lead, { repeat = false, newProduct = null } = {}) {
  if (lead.lead_type === 'partial' || lead.lead_type === 'newsletter') return;
  const s = settings.all();
  const hot = lead.score >= Number(s.hot_lead_threshold || 75);
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const reachable = !!(advisor && advisor.email && !advisor.is_demo);
  const to = new Set();
  if (reachable) to.add(advisor.email);
  // The team hears about every lead nobody can be emailed about, and about hot new leads.
  if ((hot && !repeat) || !reachable) for (const e of s.notify_emails || []) to.add(e);
  const product = bySlug[lead.product];
  const subject = repeat
    ? `${newProduct ? 'New product request' : 'Repeat request'} from ${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email} (${lead.ref})${newProduct ? ` — ${(bySlug[newProduct] || {}).short || newProduct}` : ''}`
    : `${hot ? '🔥 HOT ' : ''}New ${product ? product.short : ''} lead ${lead.ref} — score ${lead.score} (${lead.grade})`;
  for (const addr of to) {
    await mailer.sendEmail({
      lead, to: addr, kind: 'notification', track: false, subject,
      bodyMd: [
        ...(repeat ? [`This person already had a lead, so their new request was added to the same record${newProduct ? ` — they also want **${(bySlug[newProduct] || {}).name || newProduct}**` : ''}.`] : []),
        ...leadSummaryMd(lead),
        `Assigned to: ${advisor ? advisor.name : '**Unassigned — needs routing**'} · Stage: ${stages.label(lead.status)} · Score ${lead.score} (${lead.grade})`,
        `[Open in CRM](${config.siteUrl}/admin/leads/${lead.id})`,
      ].join('\n\n'),
    });
  }
}

/** Email an agent who was just given a lead by hand or by bulk reassignment. */
async function notifyAssignee(leadId, { by } = {}) {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  const advisor = lead && lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  if (!advisor || !advisor.email || advisor.is_demo) return;
  await mailer.sendEmail({
    lead, to: advisor.email, kind: 'notification', track: false,
    subject: `Lead assigned to you: ${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email} (${lead.ref})`,
    bodyMd: [`${by ? `${by} assigned` : 'You were assigned'} this lead to you.`, ...leadSummaryMd(lead), `Stage: ${stages.label(lead.status)} · Score ${lead.score} (${lead.grade})`, `[Open in CRM](${config.siteUrl}/admin/leads/${lead.id})`].join('\n\n'),
  });
}

/**
 * Move a lead to a stage. `disposition` and `note` are stored on the same timeline event, so each
 * stage change carries its outcome, notes and timestamp together.
 */
function setStatus(leadId, status, { userId, reason, disposition, note } = {}) {
  if (!STATUSES.includes(status)) throw new LeadError('Invalid stage');
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  if (!lead || lead.status === status) return lead;
  const now = U.sqlNow();
  const patch = { status, updated_at: now, stage_changed_at: now, last_activity_at: now };
  if (stages.WORKED.includes(status) && !lead.contacted_at) patch.contacted_at = now;
  if (status === 'won') patch.won_at = now;
  if (status === 'lost') patch.lost_reason = reason || (disposition && stages.dispositionByKey[disposition] ? stages.dispositionByKey[disposition].label : null);
  if (disposition) patch.disposition = disposition;
  db.update('leads', leadId, patch);
  db.insert('lead_events', { lead_id: leadId, type: 'status_change', user_id: userId, data: {
    from: lead.status, to: status, reason: reason || undefined, disposition: disposition || undefined,
    disposition_label: disposition && stages.dispositionByKey[disposition] ? stages.dispositionByKey[disposition].label : undefined, note: note || undefined,
  } });
  const updated = db.get('SELECT * FROM leads WHERE id = ?', [leadId]);
  drip.enroll(updated, 'status_changed');
  return updated;
}

/** A contact outcome and/or note without a stage change. */
function logActivity(leadId, { userId, disposition, note }) {
  const d = disposition && stages.dispositionByKey[disposition] ? disposition : null;
  if (!d && !note) return;
  const now = U.sqlNow();
  db.update('leads', leadId, { disposition: d || undefined, last_activity_at: now, updated_at: now });
  db.insert('lead_events', { lead_id: leadId, type: d ? 'disposition' : 'note', user_id: userId, data: { disposition: d || undefined, disposition_label: d ? stages.dispositionByKey[d].label : undefined, note: note || undefined } });
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

/** Find a lead by its reference, including references of records that were merged into it. */
function byRef(ref) {
  const r = String(ref || '').trim().toUpperCase();
  if (!r) return null;
  return db.get('SELECT * FROM leads WHERE ref = ?', [r])
    || db.get('SELECT l.* FROM lead_refs x JOIN leads l ON l.id = x.lead_id WHERE x.ref = ?', [r])
    || null;
}

/**
 * Permanently delete leads with everything attached (timeline, inquiries, tasks, enrolments and the
 * stored copies of emails). Unsubscribes stay in the suppression list. Returns the refs removed.
 */
function remove(ids) {
  const list = [...new Set([].concat(ids).map(Number).filter(Boolean))];
  if (!list.length) return [];
  const marks = list.map(() => '?').join(',');
  return db.tx(() => {
    const refs = db.all(`SELECT id, ref FROM leads WHERE id IN (${marks})`, list);
    db.run(`DELETE FROM emails WHERE lead_id IN (${marks})`, list);
    db.run(`UPDATE otp_requests SET lead_id = NULL WHERE lead_id IN (${marks})`, list);
    db.run(`DELETE FROM leads WHERE id IN (${marks})`, list);
    return refs;
  });
}

module.exports = {
  create, check, findExisting, sameName, recordInquiry, productsOf, valueOf, setStatus, logActivity, unsubscribe, byRef, remove,
  notifyAssignee, classifySource, normalise, LeadError, LEAD_TYPES, TYPE_RANK, STATUSES, TIMEFRAMES, ANONYMISED,
};
