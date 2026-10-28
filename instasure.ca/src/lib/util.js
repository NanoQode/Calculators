'use strict';
const crypto = require('node:crypto');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function slugify(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

const money = (n, opts = {}) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: opts.cents ? 2 : 0, minimumFractionDigits: opts.cents ? 2 : 0 }).format(Number(n) || 0);
const num = (n) => new Intl.NumberFormat('en-CA').format(Number(n) || 0);
const compact = (n) => new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

function nowIso() { return new Date().toISOString(); }
/** SQLite-friendly UTC timestamp 'YYYY-MM-DD HH:MM:SS'. */
function sqlNow(offsetMs = 0) { return new Date(Date.now() + offsetMs).toISOString().replace('T', ' ').slice(0, 19); }
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  return new Date(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
}
function fmtDate(v, style = 'long') {
  const d = toDate(v);
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('en-CA', style === 'short' ? { year: 'numeric', month: 'short', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
}
function monthYear(v = new Date()) { const d = toDate(v); return d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); }
function isoDate(v) { const d = toDate(v); return d && !isNaN(d) ? d.toISOString() : undefined; }
function timeAgo(v) {
  const d = toDate(v); if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, sec] of units) if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
  return 'just now';
}

function randomToken(bytes = 24) { return crypto.randomBytes(bytes).toString('base64url'); }
/** Human-friendly reference like IS-7K3F9Q (no ambiguous chars). */
function leadRef() {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let out = '';
  for (const b of crypto.randomBytes(6)) out += alphabet[b % alphabet.length];
  return `IS-${out}`;
}
function hmac(secret, value) { return crypto.createHmac('sha256', secret).update(String(value)).digest('base64url'); }
function safeEqual(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function hashIp(ip, secret) { return ip ? hmac(secret, ip).slice(0, 16) : null; }

function truncate(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function stripMd(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1').replace(/[#>*_`|~-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function wordCount(s) { const t = stripMd(s); return t ? t.split(/\s+/).length : 0; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'temp-mail.org', 'throwawaymail.com']);
function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function isEmail(e) { return EMAIL_RE.test(normEmail(e)); }
function isDisposable(e) { return DISPOSABLE.has(normEmail(e).split('@')[1] || ''); }
/** Normalise NANP phone → +1XXXXXXXXXX, or null. */
function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}
function fmtPhone(p) { const n = normPhone(p); return n ? `(${n.slice(2, 5)}) ${n.slice(5, 8)}-${n.slice(8)}` : String(p || ''); }
function normPostal(p) {
  const s = String(p || '').toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3)}` : null;
}
// ───── Time zones: lead caps and reports count by local calendar days and months (default Toronto). ─────
const TZ = 'America/Toronto';
function tzParts(date, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute, s: p.second };
}
function tzOffsetMs(date, tz = TZ) {
  const p = tzParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}
/** The UTC instant of local midnight on y-m-d in tz (DST-safe). */
function zonedMidnight(y, m, d, tz = TZ) {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  const off2 = tzOffsetMs(new Date(t), tz);
  if (guess - off2 !== t) t = guess - off2;
  return new Date(t);
}
const toSql = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
/** 'YYYY-MM-DD' of `date` in tz. */
function localDate(date = new Date(), tz = TZ) { const p = tzParts(date, tz); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; }
/** UTC SQL timestamp of local midnight `offsetDays` from today (0 = today, -1 = yesterday). */
function dayStartUtc(offsetDays = 0, now = new Date(), tz = TZ) {
  const p = tzParts(now, tz);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + offsetDays));
  return toSql(zonedMidnight(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), tz));
}
/** UTC SQL timestamp of local midnight on the 1st of the month (offsetMonths 0 = this month). */
function monthStartUtc(offsetMonths = 0, now = new Date(), tz = TZ) {
  const p = tzParts(now, tz);
  const base = new Date(Date.UTC(p.y, p.m - 1 + offsetMonths, 1));
  return toSql(zonedMidnight(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, tz));
}
/** 'YYYY-MM-DDTHH:MM' wall-clock time in tz → UTC SQL timestamp (DST-safe). Null when unparseable. */
function localToUtc(str, tz = TZ) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const midnight = zonedMidnight(Number(m[1]), Number(m[2]), Number(m[3]), tz);
  const guess = new Date(midnight.getTime() + (Number(m[4]) * 60 + Number(m[5])) * 60000);
  // Correct for a DST change between midnight and that time.
  const drift = tzOffsetMs(guess, tz) - tzOffsetMs(midnight, tz);
  return toSql(new Date(guess.getTime() - drift));
}
/** Local hour (0–23) in tz. */
function localHour(now = new Date(), tz = TZ) { return tzParts(now, tz).h; }
/** Date + time in tz for server-rendered text, e.g. "Oct 28, 2026, 2:05 p.m. ET". */
function fmtDateTime(v, tz = TZ) {
  const d = toDate(v); if (!d || isNaN(d)) return '';
  return d.toLocaleString('en-CA', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + (tz === TZ ? ' ET' : '');
}
/** ISO string for <time datetime> (the admin script shows it in the viewer's own time zone). */
function iso(v) { const d = toDate(v); return d && !isNaN(d) ? d.toISOString() : ''; }

function clampInt(v, min, max, dflt) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; }
function pick(obj, keys) { const o = {}; for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k]; return o; }
function arr(v) { if (Array.isArray(v)) return v; if (v === undefined || v === null || v === '') return []; return [v]; }
function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = {
  escapeHtml, slugify, money, num, compact, nowIso, sqlNow, toDate, fmtDate, monthYear, isoDate, timeAgo,
  randomToken, leadRef, hmac, safeEqual, hashIp, truncate, stripMd, wordCount,
  normEmail, isEmail, isDisposable, normPhone, fmtPhone, normPostal, clampInt, pick, arr, csvCell,
  TZ, tzParts, localDate, dayStartUtc, monthStartUtc, localToUtc, localHour, fmtDateTime, iso, maskPhone,
};

/** "(•••) •••-1234" — enough to recognise your own number without exposing it. */
function maskPhone(p) { const n = normPhone(p); return n ? `(•••) •••-${n.slice(-4)}` : ''; }
