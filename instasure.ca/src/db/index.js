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

/** Columns added after a table first shipped: CREATE TABLE IF NOT EXISTS won't add them to existing databases. */
const COLUMNS = [
  ['advisors', 'specialties', "TEXT DEFAULT '[]'"],
  ['leads', 'service', 'TEXT'],
  ['users', 'daily_report', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'note_due_lead_id', 'INTEGER'],
  ['users', 'note_due_since', 'TEXT'],
  ['advisors', 'first_name', 'TEXT'],
  ['advisors', 'last_name', 'TEXT'],
  ['advisors', 'licence_number', 'TEXT'],
  ['advisors', 'status', "TEXT NOT NULL DEFAULT 'approved'"],
  ['advisors', 'monthly_lead_cap', 'INTEGER'],
  ['advisors', 'show_on_site', 'INTEGER NOT NULL DEFAULT 1'],
  ['advisors', 'registered_at', 'TEXT'],
  ['advisors', 'approved_at', 'TEXT'],
  ['advisors', 'approved_by', 'INTEGER'],
  ['leads', 'products', "TEXT DEFAULT '[]'"],
  ['leads', 'inquiry_count', 'INTEGER NOT NULL DEFAULT 1'],
  ['leads', 'assigned_at', 'TEXT'],
  ['leads', 'phone_verified_at', 'TEXT'],
  ['leads', 'score_adjustment', 'INTEGER NOT NULL DEFAULT 0'],
  ['leads', 'disposition', 'TEXT'],
  ['leads', 'stage_changed_at', 'TEXT'],
  ['leads', 'last_activity_at', 'TEXT'],
];
/** Indexes on columns added by migration (schema.sql runs before the columns exist on older databases). */
const LATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(advisor_id, assigned_at)',
  'CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)',
  'CREATE INDEX IF NOT EXISTS idx_advisors_status ON advisors(status)',
];

/**
 * The users.role CHECK constraint gained 'agent_manager'. SQLite can't alter a CHECK, so older
 * databases get the table rebuilt (the documented 12-step procedure: foreign keys off, copy, swap).
 */
function rebuildUsersForRoles() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!row || row.sql.includes('agent_manager')) return;
  const create = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').match(/CREATE TABLE IF NOT EXISTS users \(([\s\S]*?)\n\);/);
  const keep = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    db.exec(`CREATE TABLE users_new (${create[1]}\n)`);
    const cols = db.prepare('PRAGMA table_info(users_new)').all().map((c) => c.name).filter((c) => keep.includes(c));
    db.exec(`INSERT INTO users_new (${cols.join(',')}) SELECT ${cols.join(',')} FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
    const broken = db.prepare('PRAGMA foreign_key_check').all();
    if (broken.length) throw new Error(`users rebuild left ${broken.length} broken foreign keys`);
    db.exec('COMMIT');
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function migrate() {
  for (const [table, column, type] of COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  rebuildUsersForRoles();
  for (const sql of LATE_INDEXES) db.exec(sql);
  // Leads assigned before assignment times were recorded count from their creation date (monthly caps).
  db.exec('UPDATE leads SET assigned_at = created_at WHERE advisor_id IS NOT NULL AND assigned_at IS NULL');
}

const api = {
  open(file = config.dbPath) {
    if (db) return api;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    migrate();
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
