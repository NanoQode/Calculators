'use strict';
/**
 * IndexNow: notify Bing (which also feeds ChatGPT search & Copilot), Yandex, Seznam, Naver
 * the moment content is published or updated. Google does not support IndexNow — it relies
 * on sitemaps with accurate <lastmod>, which we always emit.
 */
const config = require('../config');
const db = require('../db');
const settings = require('./settings');

async function ping(paths) {
  const key = settings.get('indexnow_key');
  const urls = [...new Set(paths)].map((p) => (p.startsWith('http') ? p : config.siteUrl + p));
  if (!key || !urls.length) return { skipped: 'no key or urls' };
  if (!config.indexNowEnabled) {
    db.insert('indexnow_log', { urls, status: 0, response: 'skipped (INDEXNOW_ENABLED is not true)' });
    return { skipped: 'disabled' };
  }
  const host = new URL(config.siteUrl).host;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${config.siteUrl}/${key}.txt`, urlList: urls.slice(0, 10000) }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text().catch(() => '');
    db.insert('indexnow_log', { urls, status: res.status, response: text.slice(0, 500) });
    return { status: res.status };
  } catch (e) {
    db.insert('indexnow_log', { urls, status: -1, response: String(e.message).slice(0, 500) });
    return { error: e.message };
  }
}

module.exports = { ping };
