'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Minimal .env loader (no dependency): KEY=value lines, # comments.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const ROOT = path.join(__dirname, '..');
const isProd = env.NODE_ENV === 'production';

function secret(name) {
  if (env[name]) return env[name];
  if (isProd) throw new Error(`${name} must be set in production`);
  // Stable dev secret persisted alongside the DB so sessions survive restarts.
  const p = path.join(ROOT, 'data', `.${name.toLowerCase()}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(p, 'utf8').trim();
}

module.exports = {
  ROOT,
  isProd,
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  // Canonical origin used for canonical tags, sitemaps, emails, JSON-LD. No trailing slash.
  siteUrl: (env.SITE_URL || 'https://instasure.ca').replace(/\/$/, ''),
  dbPath: env.DB_PATH || path.join(ROOT, 'data', 'instasure.db'),
  uploadsDir: env.UPLOADS_DIR || path.join(ROOT, 'public', 'uploads'),
  sessionSecret: secret('SESSION_SECRET'),
  trackingSecret: secret('TRACKING_SECRET'),
  trustProxy: env.TRUST_PROXY || 'loopback',
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === 'true',
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      }
    : null,
  // Drip scheduler tick. Set DRIP_DISABLED=true on secondary instances.
  dripIntervalMs: Number(env.DRIP_INTERVAL_MS || 60_000),
  dripDisabled: env.DRIP_DISABLED === 'true',
  // IndexNow pings are skipped unless explicitly enabled (avoid pinging from dev/staging).
  indexNowEnabled: env.INDEXNOW_ENABLED === 'true',
  pageCacheTtlMs: Number(env.PAGE_CACHE_TTL_MS || (isProd ? 5 * 60_000 : 0)),
  adminEmail: env.ADMIN_EMAIL || 'admin@instasure.ca',
  adminPassword: env.ADMIN_PASSWORD || null,
};
