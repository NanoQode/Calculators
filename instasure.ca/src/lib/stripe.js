'use strict';
/**
 * Minimal Stripe client for agent plan payments: form-encoded REST calls (no SDK dependency) and
 * webhook signature checks. Keys come from STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in the server
 * environment, or else from Admin → Billing → Settings (stored as secrets: never sent back to a browser).
 * Without a secret key, agents pay by Interac e-Transfer / invoice and an admin marks the invoice paid.
 */
const crypto = require('node:crypto');
const config = require('../config');

const API = 'https://api.stripe.com/v1';
let fetchImpl = (...a) => fetch(...a);

const settings = () => require('./settings');
/** Where each key comes from: 'env' (server file, wins), 'admin' (saved in Billing settings) or null. */
function source(name) {
  if (name === 'secret' && config.stripe && config.stripe.secretKey) return 'env';
  if (name === 'webhook' && config.stripe && config.stripe.webhookSecret) return 'env';
  return settings().secret(name === 'secret' ? 'stripe_secret_key' : 'stripe_webhook_secret') ? 'admin' : null;
}
function secretKey() { return (config.stripe && config.stripe.secretKey) || settings().secret('stripe_secret_key') || ''; }
function webhookSecret() { return (config.stripe && config.stripe.webhookSecret) || settings().secret('stripe_webhook_secret') || ''; }
function configured() { return !!secretKey(); }
/** "sk_test_…4242" — enough to recognise a key without revealing it. */
function mask(k) { k = String(k || ''); return k ? `${k.slice(0, k.indexOf('_', 3) + 1 || 3)}…${k.slice(-4)}` : ''; }
const testMode = () => /^(sk|rk)_test_/.test(secretKey());

/** Stripe's bracket encoding: { a: { b: [1] } } → a[b][0]=1 */
function encode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

async function call(method, path, params) {
  if (!configured()) throw new Error('Stripe is not configured');
  const body = encode(params);
  const url = API + path + (method === 'GET' && body ? `?${body}` : '');
  const res = await fetchImpl(url, {
    method,
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((json.error && json.error.message) || `Stripe request failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  return json;
}

/**
 * Check a Stripe-Signature header ("t=…,v1=…") against the raw request body.
 * Returns the parsed event, or throws.
 */
function verifyEvent(rawBody, header, secret = webhookSecret(), toleranceSec = 300, now = Date.now()) {
  if (!secret) throw new Error('Webhook secret not configured');
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header || '').split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) throw new Error('Malformed signature header');
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new Error('Signature timestamp outside tolerance');
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const ok = sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) throw new Error('Signature mismatch');
  return JSON.parse(String(rawBody));
}

/** Build a header the way Stripe does (tests and local webhook replays). */
function signPayload(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
}

module.exports = {
  configured, call, encode, verifyEvent, signPayload, source, secretKey, webhookSecret, mask, testMode,
  /** Tests swap the HTTP layer. */
  _setFetch(fn) { fetchImpl = fn || ((...a) => fetch(...a)); },
};
