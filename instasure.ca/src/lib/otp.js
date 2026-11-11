'use strict';
/**
 * SMS one-time codes for lead submissions.
 *
 * When enabled (Admin → SMS & verification) and the SMS provider is configured, a submission is
 * held in otp_requests instead of becoming a lead. A code is texted to the person's mobile number;
 * the lead is created only when they enter it (phone_verified_at is set). Codes are random, stored
 * as an HMAC (never in plain text), expire, allow a limited number of attempts, and sending is
 * throttled per submission, per phone number and per IP address. Held submissions are deleted
 * after 24 hours.
 */
const crypto = require('node:crypto');
const db = require('../db');
const settings = require('./settings');
const sms = require('./sms');
const config = require('../config');
const leads = require('./leads');
const U = require('./util');

const PER_PHONE_HOUR = 5;
const PER_IP_HOUR = 15;

class OtpError extends Error { constructor(msg, field, extra = {}) { super(msg); this.field = field; this.status = 422; Object.assign(this, extra); } }

/** Codes are required only when switched on AND texts can actually be delivered. */
function active() { return !!settings.get('otp_enabled') && sms.configured(); }

const cfg = () => {
  const s = settings.all();
  return {
    length: Math.min(8, Math.max(4, Number(s.otp_length) || 6)),
    ttl: Math.min(60, Math.max(2, Number(s.otp_ttl_minutes) || 10)),
    attempts: Math.min(10, Math.max(3, Number(s.otp_max_attempts) || 5)),
    resend: Math.min(300, Math.max(15, Number(s.otp_resend_seconds) || 30)),
    sends: Math.min(10, Math.max(1, Number(s.otp_max_sends) || 5)),
    message: s.otp_message || settings.DEFAULTS.otp_message,
  };
};
const hashCode = (token, code) => U.hmac(config.trackingSecret, `otp:${token}:${code}`);
const get = (token) => (/^[A-Za-z0-9_-]{20,64}$/.test(String(token || '')) ? db.get('SELECT * FROM otp_requests WHERE token = ?', [String(token)]) : null);
const secondsSince = (ts) => (ts ? (Date.now() - U.toDate(ts).getTime()) / 1000 : Infinity);

function view(row, extra = {}) {
  const c = cfg();
  return {
    token: row.token, stage: row.code_hash && row.phone ? 'code' : 'phone', phone: U.maskPhone(row.phone),
    retry_in: row.last_sent_at ? Math.max(0, Math.ceil(c.resend - secondsSince(row.last_sent_at))) : 0,
    length: c.length, ...extra,
  };
}

/** Hold a submission and text a code if it has a valid mobile number. The payload has already been validated. */
async function start(payload, ctx, ip) {
  const token = U.randomToken(24);
  const phone = U.normPhone(payload.phone);
  db.insert('otp_requests', { token, purpose: 'lead', phone, payload, ctx, ip_hash: U.hashIp(ip, config.trackingSecret) });
  const row = get(token);
  if (!phone) return view(row);
  return send(token, phone);
}

/** Text a (new) code. Optionally sets or changes the phone number first. */
async function send(token, phoneInput) {
  const row = get(token);
  if (!row || row.verified_at) throw new OtpError('This verification has expired. Please submit the form again.', 'token', { expired: true });
  if (secondsSince(row.created_at) > 24 * 3600) throw new OtpError('This verification has expired. Please submit the form again.', 'token', { expired: true });
  const c = cfg();
  const phone = phoneInput ? U.normPhone(phoneInput) : row.phone;
  if (!phone) throw new OtpError('Enter a 10-digit Canadian or US mobile number that can receive texts.', 'phone');
  if (row.send_count >= c.sends) throw new OtpError('Too many codes sent for this request. Please wait a few minutes and submit the form again.', 'phone');
  if (phone === row.phone && secondsSince(row.last_sent_at) < c.resend) throw new OtpError(`Please wait ${Math.ceil(c.resend - secondsSince(row.last_sent_at))} seconds before asking for another code.`, 'code', { retry_in: Math.ceil(c.resend - secondsSince(row.last_sent_at)) });
  const recentToPhone = db.value("SELECT COUNT(*) FROM sms_messages WHERE to_phone = ? AND kind = 'otp' AND created_at >= datetime('now','-1 hour')", [phone]) || 0;
  if (recentToPhone >= PER_PHONE_HOUR) throw new OtpError('Too many codes were sent to this number in the last hour. Please try again later.', 'phone');
  if (row.ip_hash) {
    const recentFromIp = db.value("SELECT COALESCE(SUM(send_count),0) FROM otp_requests WHERE ip_hash = ? AND created_at >= datetime('now','-1 hour')", [row.ip_hash]) || 0;
    if (recentFromIp >= PER_IP_HOUR) throw new OtpError('Too many verification codes requested. Please try again later.', 'phone');
  }
  const code = String(crypto.randomInt(0, 10 ** c.length)).padStart(c.length, '0');
  const body = String(c.message).replace(/\{code\}/g, code).replace(/\{minutes\}/g, String(c.ttl)).replace(/\{(\w+)\}/g, (m, k) => (settings.get(k) !== undefined ? String(settings.get(k)) : m));
  const r = await sms.send(phone, body, { kind: 'otp', mask: body.replace(code, '•'.repeat(code.length)) });
  if (!r.ok) throw new OtpError('We couldn’t send a text to that number. Check that it’s a mobile number and try again.', 'phone');
  const payload = db.json(row.payload, {});
  payload.phone = phone;
  db.update('otp_requests', row.id, {
    phone, payload, code_hash: hashCode(token, code), attempts: 0, send_count: row.send_count + 1,
    last_sent_at: U.sqlNow(), expires_at: U.sqlNow(c.ttl * 60 * 1000),
  });
  return view(get(token), { sent: true });
}

/** Check a code; on success create (or update) the lead with the phone marked verified. */
async function verify(token, codeInput) {
  const row = get(token);
  if (!row) throw new OtpError('This verification has expired. Please submit the form again.', 'token', { expired: true });
  if (row.verified_at && row.lead_id) {
    const lead = db.get('SELECT * FROM leads WHERE id = ?', [row.lead_id]);
    if (lead) return lead; // double submit: same result
  }
  const c = cfg();
  const code = String(codeInput || '').replace(/\D/g, '');
  if (!row.code_hash) throw new OtpError('Enter your mobile number first.', 'phone');
  if (!row.expires_at || U.toDate(row.expires_at).getTime() < Date.now()) throw new OtpError('That code has expired. Ask for a new one.', 'code');
  if (row.attempts >= c.attempts) throw new OtpError('Too many incorrect codes. Ask for a new one.', 'code');
  if (code.length !== c.length || !U.safeEqual(hashCode(token, code), row.code_hash)) {
    db.run('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    const left = c.attempts - row.attempts - 1;
    throw new OtpError(left > 0 ? `That code isn’t right. ${left} attempt${left > 1 ? 's' : ''} left.` : 'Too many incorrect codes. Ask for a new one.', 'code');
  }
  // Claim the request once, so a double click can't create two leads.
  const claimed = db.run('UPDATE otp_requests SET verified_at = CURRENT_TIMESTAMP WHERE id = ? AND verified_at IS NULL', [row.id]).changes;
  if (!claimed) { const again = get(token); if (again.lead_id) return db.get('SELECT * FROM leads WHERE id = ?', [again.lead_id]); }
  const payload = db.json(row.payload, {});
  const ctx = db.json(row.ctx, {});
  const lead = await leads.create({ ...payload, phone: row.phone }, ctx, { phoneVerified: true });
  db.update('otp_requests', row.id, { lead_id: lead.id, payload: {}, ctx: {} });
  return lead;
}

/** Remove held submissions (they contain personal information) after a day. */
function cleanup() {
  db.run("DELETE FROM otp_requests WHERE created_at < datetime('now','-1 day')");
}

module.exports = { active, start, send, verify, cleanup, get, view, OtpError, PER_PHONE_HOUR, PER_IP_HOUR };
