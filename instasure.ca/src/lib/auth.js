'use strict';
/**
 * Admin authentication: scrypt password hashes, server-side sessions in SQLite (httpOnly,
 * SameSite=Lax, Secure in production), per-session CSRF tokens, role checks and
 * brute-force throttling on login.
 */
const crypto = require('node:crypto');
const db = require('../db');
const config = require('../config');
const { randomToken, safeEqual, sqlNow } = require('./util');

const COOKIE = 'isa_sid';
const SESSION_HOURS = 12;
const ROLES = { admin: 4, editor: 3, advisor: 2, viewer: 1 };

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltB64, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(hash, Buffer.from(hashB64, 'base64'));
}

function tooManyAttempts(email, ip) {
  const n = db.value("SELECT COUNT(*) FROM login_attempts WHERE ok = 0 AND (email = ? OR ip = ?) AND created_at >= datetime('now','-15 minutes')", [email, ip]);
  return n >= 8;
}

function login(email, password, req) {
  const ip = req.ip;
  if (tooManyAttempts(email, ip)) return { error: 'Too many attempts. Try again in 15 minutes.' };
  const user = db.get('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
  const ok = !!user && verifyPassword(password, user.password_hash);
  db.insert('login_attempts', { email, ip, ok: ok ? 1 : 0 });
  if (!ok) return { error: 'Invalid email or password.' };
  const id = randomToken(32);
  db.insert('sessions', { id, user_id: user.id, csrf: randomToken(24), expires_at: sqlNow(SESSION_HOURS * 3600 * 1000), ip, ua: String(req.get('user-agent') || '').slice(0, 200) });
  db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  return { sessionId: id, user };
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/', maxAge: SESSION_HOURS * 3600 * 1000 };
}

/** Attach req.user / req.session when a valid session cookie is present. */
function loadSession(req, res, next) {
  const sid = req.cookies && req.cookies[COOKIE];
  if (sid) {
    const s = db.get(`SELECT s.id, s.csrf, s.expires_at, u.id AS uid, u.email, u.name, u.role, u.advisor_id
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1`, [sid]);
    if (s) {
      req.session = { id: s.id, csrf: s.csrf };
      req.user = { id: s.uid, email: s.email, name: s.name, role: s.role, advisor_id: s.advisor_id };
    }
  }
  next();
}

function logout(req, res) {
  if (req.session) db.run('DELETE FROM sessions WHERE id = ?', [req.session.id]);
  res.clearCookie(COOKIE, { path: '/' });
}

function requireUser(req, res, next) {
  if (!req.user) return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
  res.set('Cache-Control', 'no-store');
  next();
}
function requireRole(min) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/admin/login');
    if ((ROLES[req.user.role] || 0) < ROLES[min]) return res.status(403).render('admin/error', { title: 'Forbidden', message: `This area needs the “${min}” role or higher.`, layout: 'admin' });
    next();
  };
}
function can(user, min) { return !!user && (ROLES[user.role] || 0) >= ROLES[min]; }

/** CSRF check for state-changing admin requests (form field _csrf or header x-csrf-token). */
function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = (req.body && req.body._csrf) || req.get('x-csrf-token') || (req.is('multipart/form-data') ? req.query._csrf : undefined);
  if (!req.session || !token || !safeEqual(token, req.session.csrf)) return res.status(403).send('Invalid or expired form token. Go back, refresh the page and try again.');
  next();
}

module.exports = { COOKIE, ROLES, hashPassword, verifyPassword, login, logout, loadSession, requireUser, requireRole, can, csrf, cookieOptions };
