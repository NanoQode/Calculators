'use strict';
/** Tiny in-memory HTML page cache for anonymous GETs (purged on any content/settings change). */
const config = require('../config');

const store = new Map();
const hooks = [];
const MAX = 2000;

function get(key) {
  if (!config.pageCacheTtlMs) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { store.delete(key); return null; }
  return hit;
}
function set(key, body, headers = {}) {
  if (!config.pageCacheTtlMs) return;
  if (store.size >= MAX) store.delete(store.keys().next().value);
  store.set(key, { body, headers, exp: Date.now() + config.pageCacheTtlMs });
}
function clear() { store.clear(); for (const fn of hooks) { try { fn(); } catch { /* ignore */ } } }
/** Register a callback run whenever caches are purged (e.g. sitemap/llms memo). */
function onClear(fn) { hooks.push(fn); }
function size() { return store.size; }

module.exports = { get, set, clear, size, onClear };
