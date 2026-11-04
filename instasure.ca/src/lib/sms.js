'use strict';
/**
 * Text messages through VoIP.ms (configured in Admin → SMS & verification).
 *
 * VoIP.ms REST API: GET https://voip.ms/api/v1/rest.php with api_username, api_password,
 * method=sendSMS, did (an SMS-enabled DID on the account), dst (10-digit number) and message
 * (160 characters max). It answers JSON; status "success" means accepted. Before it works the API
 * must be enabled in the VoIP.ms portal (Main Menu → SOAP & REST/JSON API) with an API password,
 * and this server's IP address added to the API's allowed IPs.
 *
 * Every message is recorded in sms_messages (one-time codes masked). Outside production the
 * 'log' provider records messages without sending, so the whole flow can be tested.
 */
const db = require('../db');
const settings = require('./settings');
const config = require('../config');
const { normPhone } = require('./util');

const ENDPOINT = 'https://voip.ms/api/v1/rest.php';
const HINTS = {
  invalid_credentials: 'VoIP.ms rejected the API username or password. Use the API password set under SOAP & REST/JSON API (not your portal login password).',
  ip_not_enabled: 'VoIP.ms refused this server’s IP address. Add it to the allowed IPs under SOAP & REST/JSON API.',
  api_not_enabled: 'The VoIP.ms API is not enabled on this account (Main Menu → SOAP & REST/JSON API).',
  missing_did: 'No sending number set. Enter an SMS-enabled DID from your VoIP.ms account.',
  invalid_did: 'The sending number is not an SMS-enabled DID on this VoIP.ms account.',
  sms_toolong: 'The message is longer than 160 characters.',
  invalid_dst: 'VoIP.ms says the destination number is not valid.',
};

/** In non-production, the last messages sent through the 'log' provider (tests read codes here). */
const outbox = [];

function provider() {
  const p = settings.get('sms_provider') || 'voipms';
  return p === 'log' && !config.isProd ? 'log' : 'voipms';
}

/** True when a message could actually be delivered (or logged, outside production). */
function configured() {
  if (provider() === 'log') return true;
  return !!(settings.get('voipms_username') && settings.secret('voipms_password') && /^\d{10}$/.test(String(settings.get('voipms_did') || '')));
}

/** Test seam: replaced in tests to stand in for the VoIP.ms HTTP call. */
let transport = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { status: `http_${res.status}`, raw: text.slice(0, 200) }; }
};

/**
 * Send one text. `mask` is the string to store instead of the body (e.g. with the code hidden).
 * @returns {Promise<{ok:boolean,status:string,error?:string,id:number}>}
 */
async function send(to, body, { kind = 'otp', mask } = {}) {
  const dst = normPhone(to);
  const message = String(body || '').slice(0, 160);
  const p = provider();
  const id = db.insert('sms_messages', { to_phone: dst || String(to || '').slice(0, 30), body: mask || message, kind, provider: p, status: 'queued' });
  if (!dst) { db.update('sms_messages', id, { status: 'failed', error: 'Not a valid Canadian or US mobile number' }); return { ok: false, status: 'failed', error: 'invalid_number', id }; }
  if (p === 'log') {
    outbox.push({ to: dst, body: message, kind, at: Date.now() }); if (outbox.length > 50) outbox.shift();
    if (process.env.NODE_ENV === 'development') console.log(`[sms] (not sent: log provider) to ${dst}: ${message}`);
    db.update('sms_messages', id, { status: 'logged' });
    return { ok: true, status: 'logged', id };
  }
  if (!configured()) { db.update('sms_messages', id, { status: 'failed', error: 'VoIP.ms is not configured' }); return { ok: false, status: 'failed', error: 'not_configured', id }; }
  const qs = new URLSearchParams({
    api_username: settings.get('voipms_username'), api_password: settings.secret('voipms_password'),
    method: 'sendSMS', did: String(settings.get('voipms_did')), dst: dst.slice(2), message,
  });
  try {
    const r = await transport(`${ENDPOINT}?${qs}`);
    if (r && r.status === 'success') { db.update('sms_messages', id, { status: 'sent', provider_id: r.sms ? String(r.sms) : null }); return { ok: true, status: 'sent', id }; }
    const code = (r && r.status) || 'unknown_error';
    db.update('sms_messages', id, { status: 'failed', error: HINTS[code] ? `${code}: ${HINTS[code]}` : code });
    return { ok: false, status: 'failed', error: code, hint: HINTS[code], id };
  } catch (e) {
    db.update('sms_messages', id, { status: 'failed', error: String(e.message || e).slice(0, 300) });
    return { ok: false, status: 'failed', error: 'network', id };
  }
}

module.exports = { send, configured, provider, outbox, HINTS, ENDPOINT, _setTransport: (fn) => { transport = fn; } };
