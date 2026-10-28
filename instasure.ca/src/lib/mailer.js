'use strict';
/**
 * Email delivery + CASL-compliant rendering.
 *  - SMTP via nodemailer when SMTP_HOST is configured; otherwise messages are stored with status
 *    "logged" (visible in Admin → Email log) so the whole pipeline is testable without sending.
 *  - Every commercial message carries sender identification (legal name, mailing address, contact)
 *    and a one-click unsubscribe (link + RFC 8058 List-Unsubscribe headers).
 *  - Opens (pixel) and clicks (signed redirect) are tracked per message and feed lead scoring.
 */
const nodemailer = require('nodemailer');
const config = require('../config');
const db = require('../db');
const settings = require('./settings');
const md = require('./markdown');
const { escapeHtml, randomToken, hmac, sqlNow, money } = require('./util');

let transport = null;
function getTransport() {
  if (transport !== null) return transport;
  transport = config.smtp ? nodemailer.createTransport(config.smtp) : false;
  return transport;
}

function unsubscribeUrl(lead) {
  return `${config.siteUrl}/unsubscribe?l=${encodeURIComponent(lead.ref)}&s=${hmac(config.trackingSecret, 'u:' + lead.ref).slice(0, 22)}`;
}
function verifyUnsubscribe(ref, sig) { return sig === hmac(config.trackingSecret, 'u:' + ref).slice(0, 22); }
function clickUrl(token, url) {
  return `${config.siteUrl}/e/c/${token}?u=${encodeURIComponent(url)}&s=${hmac(config.trackingSecret, `c:${token}:${url}`).slice(0, 16)}`;
}
function verifyClick(token, url, sig) { return sig === hmac(config.trackingSecret, `c:${token}:${url}`).slice(0, 16); }

/** Merge-tag context for a lead. */
function mergeContext(lead, extra = {}) {
  const { bySlug } = require('../data/products');
  const geo = require('../data/geo');
  const product = bySlug[lead.product] || {};
  const prov = geo.provinceByCode[lead.province] || {};
  const city = lead.city ? geo.cityByKey[`${lead.province}/${lead.city}`] : null;
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const est = db.json(lead.estimate, {});
  const s = settings.all();
  return {
    first_name: lead.first_name || 'there',
    name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'there',
    ref: lead.ref,
    product_name: product.name || 'insurance',
    product_short: (product.short || 'insurance').toLowerCase(),
    product_url: product.slug ? `${config.siteUrl}/${product.slug}/` : config.siteUrl,
    calculator_url: product.calculator ? config.siteUrl + product.calculator : `${config.siteUrl}/calculators/`,
    province_name: prov.name || 'your province',
    city_name: city ? city.name : prov.name || 'your area',
    advisor_name: advisor ? advisor.name : `the ${s.site_name} advisor team`,
    advisor_first_name: advisor ? advisor.name.split(' ')[0] : 'our team',
    advisor_phone: advisor && advisor.phone ? advisor.phone : s.phone || '',
    advisor_booking_url: advisor && advisor.booking_url ? advisor.booking_url : `${config.siteUrl}/advisors/`,
    quote_url: `${config.siteUrl}/quote/results/${lead.ref}/`,
    estimate_low: est.low !== undefined ? money(est.low, { cents: est.low < 100 }) : '',
    estimate_high: est.high !== undefined ? money(est.high, { cents: est.high < 100 }) : '',
    estimate_period: est.periodLabel || '/mo',
    site_name: s.site_name,
    site_url: config.siteUrl,
    unsubscribe_url: unsubscribeUrl(lead),
    ...extra,
  };
}

function merge(str, ctx) {
  return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null ? String(ctx[k]) : ''));
}

/** Wrap rendered body HTML in the branded, table-based email layout with CASL footer. */
function layout({ bodyHtml, preheader = '', ctaLabel, ctaUrl, unsubscribe, token, commercial = true }) {
  const s = settings.all();
  const sender = [s.legal_name || s.site_name, s.mailing_address].filter(Boolean).map(escapeHtml).join(' · ');
  const contact = [s.email, s.phone].filter(Boolean).map(escapeHtml).join(' · ');
  const cta = ctaLabel && ctaUrl
    ? `<tr><td style="padding:8px 32px 24px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#006c46;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px">${escapeHtml(ctaLabel)} →</a></td></tr>`
    : '';
  const pixel = token ? `<img src="${config.siteUrl}/e/o/${token}.gif" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(s.site_name)}</title></head>
<body style="margin:0;padding:0;background:#eff4ff;font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif;color:#0b1c30">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 32px;background:#0a1e33"><a href="${config.siteUrl}" style="color:#ffffff;text-decoration:none;font-size:20px;font-weight:800;letter-spacing:-0.3px">⚡ Instasure<span style="color:#53de9e">.ca</span></a></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:15px;line-height:24px">${bodyHtml}</td></tr>
${cta}
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e5eeff;font-size:12px;line-height:18px;color:#44474d">
${commercial ? `You’re receiving this because you requested information or a quote from ${escapeHtml(s.site_name)}.<br>` : ''}
<strong>${sender}</strong><br>${contact} · <a href="${config.siteUrl}" style="color:#006c46">${escapeHtml(config.siteUrl.replace(/^https?:\/\//, ''))}</a><br>
${unsubscribe ? `<a href="${escapeHtml(unsubscribe)}" style="color:#006c46">Unsubscribe</a> — we’ll stop marketing emails right away.` : ''}
<br><span style="color:#74777d">${escapeHtml(s.licence_disclosure || '')}</span>
</td></tr></table></td></tr></table>${pixel}</body></html>`;
}

function rewriteLinks(html, token) {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (m, url) => {
    if (url.includes('/unsubscribe') || url.includes('/e/o/')) return m;
    return `href="${escapeHtml(clickUrl(token, url.replace(/&amp;/g, '&')))}"`;
  });
}

function toText(html) {
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '$2 ($1)')
    .replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|tr|h\d|li)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function isSuppressed(email) {
  return !!db.get('SELECT 1 FROM suppressions WHERE email = ?', [String(email || '').toLowerCase()]);
}

/**
 * Compose, record and send one email.
 * @param {object} o { lead, to, subject, bodyMd, preheader, ctaLabel, ctaUrl, kind, enrollmentId, stepId, track, commercial }
 */
async function sendEmail(o) {
  const lead = o.lead || null;
  const to = o.to || (lead && lead.email);
  const kind = o.kind || 'drip';
  const ctx = lead ? mergeContext(lead, o.context) : { site_name: settings.get('site_name'), site_url: config.siteUrl, ...(o.context || {}) };
  const subject = merge(o.subject, ctx);
  const token = randomToken(18);
  const unsubscribe = lead && kind !== 'notification' ? unsubscribeUrl(lead) : null;
  let bodyHtml = md.render(merge(o.bodyMd, ctx)).html;
  let html = layout({ bodyHtml, preheader: merge(o.preheader, ctx), ctaLabel: merge(o.ctaLabel, ctx), ctaUrl: merge(o.ctaUrl, ctx), unsubscribe, token: o.track === false ? null : token, commercial: kind !== 'notification' });
  if (o.track !== false && kind !== 'notification') html = rewriteLinks(html, token);
  const text = toText(html);

  const id = db.insert('emails', {
    token, lead_id: lead ? lead.id : null, enrollment_id: o.enrollmentId || null, step_id: o.stepId || null,
    kind, to_email: to, subject, html, text, status: 'queued',
  });

  if (kind !== 'notification' && isSuppressed(to)) {
    db.update('emails', id, { status: 'suppressed', error: 'Recipient unsubscribed/suppressed' });
    return { id, status: 'suppressed' };
  }
  const s = settings.all();
  const headers = {};
  if (unsubscribe) {
    headers['List-Unsubscribe'] = `<${unsubscribe}>, <mailto:${s.email}?subject=unsubscribe>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  const t = getTransport();
  if (!t) {
    db.update('emails', id, { status: 'logged', sent_at: sqlNow() });
    if (!config.isProd && process.env.NODE_ENV !== 'test') console.log(`[mail:logged] → ${to} | ${subject}`);
    return { id, status: 'logged' };
  }
  try {
    const info = await t.sendMail({
      from: { name: s.from_name, address: s.from_email }, to, subject, html, text, headers,
      replyTo: s.reply_to || undefined,
    });
    db.update('emails', id, { status: 'sent', provider_id: info.messageId, sent_at: sqlNow() });
    return { id, status: 'sent' };
  } catch (e) {
    db.update('emails', id, { status: 'failed', error: String(e.message || e).slice(0, 500) });
    return { id, status: 'failed', error: e.message };
  }
}

module.exports = { sendEmail, merge, mergeContext, layout, unsubscribeUrl, verifyUnsubscribe, clickUrl, verifyClick, isSuppressed, toText };
