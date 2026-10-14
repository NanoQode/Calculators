'use strict';
/** Boots a fresh app on an ephemeral port with a throwaway SQLite DB. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'instasure-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.UPLOADS_DIR = path.join(dir, 'uploads');
process.env.SITE_URL = 'https://instasure.test';
process.env.ADMIN_EMAIL = 'admin@instasure.test';
process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
process.env.PAGE_CACHE_TTL_MS = '0';

const { seed } = require('../src/db/seed');
const { createApp } = require('../src/app');

let server, base;
async function start() {
  if (server) return base;
  seed({ quiet: true });
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}
async function stop() { if (server) await new Promise((r) => server.close(r)); server = null; }

/** Minimal cookie-aware client. */
function client() {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return async function req(p, opts = {}) {
    const res = await fetch(base + p, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie: cookieHeader() } });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
}

function form(obj) { return new URLSearchParams(obj).toString(); }

module.exports = { start, stop, client, form, dir };
