'use strict';
/**
 * Thin wrapper around Node's built-in SQLite (node:sqlite, Node >= 22.5).
 * Zero native dependencies; swap for Postgres later by re-implementing this module.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let db;
const stmtCache = new Map();

function clean(params) {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params.map((v) => normalize(v));
  if (params && typeof params === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(params)) out[k] = normalize(v);
    return [out];
  }
  return [normalize(params)];
}

function normalize(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object' && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
}

function prepare(sql) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

const api = {
  open(file = config.dbPath) {
    if (db) return api;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    return api;
  },
  close() {
    if (db) db.close();
    db = null;
    stmtCache.clear();
  },
  get raw() { return db; },
  run(sql, params) { return prepare(sql).run(...clean(params)); },
  get(sql, params) { const r = prepare(sql).get(...clean(params)); return r ? { ...r } : undefined; },
  all(sql, params) { return prepare(sql).all(...clean(params)).map((r) => ({ ...r })); },
  value(sql, params) { const r = api.get(sql, params); return r ? Object.values(r)[0] : undefined; },
  exec(sql) { db.exec(sql); },
  /** Run fn inside a transaction (nested calls join the outer transaction). */
  tx(fn) {
    if (db.isTransaction) return fn();
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },
  /** INSERT helper: insert('leads', {a:1}) → lastInsertRowid */
  insert(table, row) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((k) => '@' + k).join(',')})`;
    const params = {};
    for (const k of keys) params[k] = row[k];
    return Number(api.run(sql, params).lastInsertRowid);
  },
  /** UPDATE helper: update('leads', id, {a:1}) */
  update(table, id, row, idCol = 'id') {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (!keys.length) return 0;
    const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=@${k}`).join(',')} WHERE ${idCol}=@__id`;
    const params = { __id: id };
    for (const k of keys) params[k] = row[k];
    return Number(api.run(sql, params).changes);
  },
};

/** Parse JSON columns safely. */
api.json = function json(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

module.exports = api;
