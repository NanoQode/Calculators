'use strict';
/**
 * Agent portal inside the admin: sign-up (public), the agent's own dashboard (/admin/me),
 * profile editing, and a password page for every user.
 */
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const auth = require('../../lib/auth');
const settings = require('../../lib/settings');
const media = require('../../lib/media');
const agents = require('../../lib/agents');
const tasks = require('../../lib/tasks');
const tracking = require('../../lib/tracking');
const stages = require('../../lib/stages');
const config = require('../../config');
const geo = require('../../data/geo');
const { CATEGORIES } = require('../../data/products');
const { arr, sqlNow, normPhone } = require('../../lib/util');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: media.MAX_BYTES + 1, files: 1, fields: 40 } });
const LANGS = { en: 'English', fr: 'French', pa: 'Punjabi', hi: 'Hindi', zh: 'Chinese', tl: 'Tagalog', ar: 'Arabic', es: 'Spanish', ur: 'Urdu', ta: 'Tamil', gu: 'Gujarati' };

/** Routes that work without a session (mounted before requireUser). */
const pub = express.Router();
const regLimiter = tracking.rateLimit({ windowMs: 15 * 60_000, max: 8 });

function sameOrigin(req) {
  const origin = req.get('origin') || req.get('referer') || '';
  if (!origin) return true; // some privacy tools strip both; the other checks still apply
  try { const h = new URL(origin).host; return h === req.get('host') || h === new URL(config.siteUrl).host; } catch { return false; }
}

pub.get('/register', (req, res) => {
  if (req.user) return res.redirect('/admin/me');
  res.render('admin/register', { open: settings.get('agent_registration_open') !== false, error: null, field: null, b: {}, provinces: geo.provinces, CATEGORIES, LANGS, ts: Date.now(), s: settings.all() });
});
pub.post('/register', regLimiter, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    const b = req.body || {};
    const again = (status, error, field) => res.status(status).render('admin/register', { open: true, error, field, b, provinces: geo.provinces, CATEGORIES, LANGS, ts: Date.now(), s: settings.all() });
    if (err) return again(422, 'The photo could not be uploaded (PNG, JPEG or WebP up to 5 MB).', 'photo');
    if (settings.get('agent_registration_open') === false) return again(403, 'Agent registration is closed right now.');
    if (!sameOrigin(req)) return again(403, 'Please submit the form from this site.');
    if (b.website || (Number(b._ts) && Date.now() - Number(b._ts) < 3000)) return res.redirect(303, '/admin/login'); // bots
    let out;
    try { out = agents.register(b, req.file); } catch (e) {
      if (e instanceof agents.AgentError) return again(422, e.message, e.field);
      return next(e);
    }
    agents.notifyManagers(out).catch(() => {});
    const r = auth.login(out.email, String(b.password), req);
    if (r.sessionId) res.cookie(auth.COOKIE, r.sessionId, auth.cookieOptions());
    res.redirect(303, '/admin/me?_ok=' + encodeURIComponent('Thanks — your registration is in. We’ll email you once your licence is checked and your account is approved.'));
  });
});

/** Routes for signed-in users. */
const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.user.advisor_id) return res.redirect('/admin/');
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [req.user.advisor_id]);
  if (!a) return res.redirect('/admin/');
  res.admin('performance', { title: 'My portal', p: agents.performance(a.id), stages, own: true, myTasks: tasks.list({ userId: req.user.id, show: 'open' }) });
});

router.get('/profile', (req, res) => {
  if (!req.user.advisor_id) return res.redirect('/admin/account');
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [req.user.advisor_id]);
  if (!a) return res.redirect('/admin/account');
  res.admin('profile', { title: 'My profile', a, LANGS, provinces: geo.provinces, CATEGORIES });
});
router.post('/profile', (req, res) => {
  if (!req.user.advisor_id) return res.redirect('/admin/account');
  upload.single('photo')(req, res, (err) => {
    if (err) return res.redirect(303, '/admin/profile?_err=' + encodeURIComponent('Photo upload failed (max 5 MB).'));
    const b = req.body;
    const phone = normPhone(b.phone);
    if (!phone) return res.redirect(303, '/admin/profile?_err=' + encodeURIComponent('Enter a 10-digit phone number.'));
    // Agents edit how they're reached and presented; licences, provinces and lines are changed by an admin after a licence check.
    const row = {
      phone, booking_url: /^https:\/\//.test(b.booking_url || '') ? b.booking_url : null, bio_md: String(b.bio_md || '').slice(0, 5000),
      languages: arr(b.languages).filter((l) => LANGS[l]), accepting_leads: b.accepting_leads ? 1 : 0, updated_at: sqlNow(),
    };
    if (req.file) {
      try { row.photo = media.save(req.file.buffer, { originalName: req.file.originalname, alt: req.user.name, userId: req.user.id }).url; } catch (e) { return res.redirect(303, '/admin/profile?_err=' + encodeURIComponent(e.message)); }
    }
    db.update('advisors', req.user.advisor_id, row);
    db.insert('audit_log', { user_id: req.user.id, action: 'update', entity: 'advisor_profile', entity_id: String(req.user.advisor_id), data: Object.keys(row) });
    res.redirect(303, '/admin/profile?_ok=Saved');
  });
});

router.get('/account', (req, res) => res.admin('account', { title: 'My account', u: db.get('SELECT id, name, email, role, daily_report, last_login_at FROM users WHERE id = ?', [req.user.id]) }));
router.post('/account', (req, res) => {
  const u = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const b = req.body;
  if (b.new_password) {
    if (!auth.verifyPassword(String(b.current_password || ''), u.password_hash)) return res.redirect(303, '/admin/account?_err=' + encodeURIComponent('Your current password is not right.'));
    if (String(b.new_password).length < 12) return res.redirect(303, '/admin/account?_err=' + encodeURIComponent('Use at least 12 characters.'));
    if (b.new_password !== b.confirm_password) return res.redirect(303, '/admin/account?_err=' + encodeURIComponent('The new passwords don’t match.'));
    db.update('users', u.id, { password_hash: auth.hashPassword(b.new_password) });
    db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [u.id, req.session.id]);
    db.insert('audit_log', { user_id: u.id, action: 'password', entity: 'user', entity_id: String(u.id) });
    return res.redirect(303, '/admin/account?_ok=' + encodeURIComponent('Password changed. Other sessions were signed out.'));
  }
  if (auth.hasPerm(req.user, 'reports')) db.update('users', u.id, { daily_report: b.daily_report ? 1 : 0 });
  res.redirect(303, '/admin/account?_ok=Saved');
});

module.exports = { pub, router };
