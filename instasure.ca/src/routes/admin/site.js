'use strict';
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const auth = require('../../lib/auth');
const settings = require('../../lib/settings');
const scoring = require('../../lib/scoring');
const pages = require('../../lib/pages');
const cache = require('../../lib/cache');
const media = require('../../lib/media');
const seo = require('../../lib/seo');
const { products, CATEGORIES, bySlug } = require('../../data/products');
const geo = require('../../data/geo');
const { slugify, arr, sqlNow } = require('../../lib/util');
const { deskBySlug } = require('../../lib/specialties');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: media.MAX_BYTES + 1, files: 1 } });
const LANGS = { en: 'English', fr: 'French', pa: 'Punjabi', hi: 'Hindi', zh: 'Chinese', tl: 'Tagalog', ar: 'Arabic', es: 'Spanish', ur: 'Urdu', ta: 'Tamil', gu: 'Gujarati' };

function purge() { cache.clear(); pages.invalidate(); seo.clearOverrides(); try { require('../system').clearMemo(); } catch { /* ignore */ } }

// ───────────── Settings ─────────────
router.get('/settings', auth.requireRole('admin'), (req, res) => res.admin('settings', { title: 'Site settings', st: settings.all(), provinces: geo.provinces, config: require('../../config') }));
router.post('/settings', auth.requireRole('admin'), (req, res) => {
  const b = req.body;
  const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const patch = {
    site_name: b.site_name, legal_name: b.legal_name, tagline: b.tagline, phone: b.phone, phone_hours: b.phone_hours, email: b.email, mailing_address: b.mailing_address,
    privacy_officer: b.privacy_officer, founded_year: b.founded_year, licence_disclosure: b.licence_disclosure, quote_disclaimer: b.quote_disclaimer,
    serviceable_provinces: arr(b.serviceable_provinces).filter((c) => geo.provinceByCode[c]), waitlist_message: b.waitlist_message,
    rating_value: b.rating_value, rating_count: b.rating_count, rating_source: b.rating_source,
    carriers: lines(b.carriers), carriers_confirmed: b.carriers_confirmed === 'on', social_links: lines(b.social_links).filter((u) => /^https:\/\//.test(u)),
    ga4_id: String(b.ga4_id || '').trim(), gsc_verification: String(b.gsc_verification || '').trim(), bing_verification: String(b.bing_verification || '').trim(),
    ai_bot_policy: ['allow_all', 'search_only', 'block_all'].includes(b.ai_bot_policy) ? b.ai_bot_policy : 'allow_all', robots_extra: b.robots_extra,
    casl_mode: b.casl_mode === 'express_or_implied' ? 'express_or_implied' : 'express_only', consent_text: b.consent_text,
    from_name: b.from_name, from_email: b.from_email, reply_to: b.reply_to, notify_emails: lines(String(b.notify_emails || '').replace(/,/g, '\n')),
    hot_lead_threshold: Math.min(100, Math.max(0, Number(b.hot_lead_threshold) || 75)), lead_dedupe_hours: Math.max(0, Number(b.lead_dedupe_hours) || 24),
    quiet_hours: { start: Math.min(23, Math.max(0, Number(b.quiet_start) || 8)), end: Math.min(24, Math.max(1, Number(b.quiet_end) || 20)) },
    advisor_response_hours: Number(b.advisor_response_hours) || 0, announcement: b.announcement, analytics_cookie_banner: b.analytics_cookie_banner === 'on',
    default_og_image: b.default_og_image,
    estimates_reviewed_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b.estimates_reviewed_at || '')) ? b.estimates_reviewed_at : settings.get('estimates_reviewed_at'),
  };
  if (patch.rating_value && !patch.rating_source) return res.redirect(303, '/admin/settings?_err=' + encodeURIComponent('A public rating needs a named, verifiable source (e.g. Google reviews).'));
  settings.setMany(patch);
  scoring.invalidate(); purge();
  res.locals.audit('update', 'settings', '', Object.keys(patch));
  res.redirect(303, '/admin/settings?_ok=Settings+saved');
});

// ───────────── Advisors ─────────────
router.get('/advisors', auth.requireRole('editor'), (req, res) => {
  const rows = db.all(`SELECT a.*, (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status IN ('new','contacted','quoted','application')) open_leads,
    (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status = 'won') won, (SELECT COUNT(*) FROM users u WHERE u.advisor_id = a.id) has_login FROM advisors a ORDER BY a.active DESC, a.is_demo, a.name`);
  const coverage = geo.provinces.map((p) => ({ p, n: rows.filter((a) => a.active && !a.is_demo && db.json(a.provinces, []).includes(p.code)).length }));
  res.admin('advisors', { title: 'Advisors', rows, coverage, CATEGORIES });
});
router.get('/advisors/new', auth.requireRole('editor'), (req, res) => res.admin('advisor-edit', { title: 'New advisor', a: { languages: '["en"]', provinces: '[]', categories: '[]', specialties: '[]', licences: '[]', active: 1, accepting_leads: 1, weight: 1, max_open_leads: 150 }, provinces: geo.provinces, CATEGORIES, LANGS }));
router.get('/advisors/:id', auth.requireRole('editor'), (req, res, next) => {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return next();
  res.admin('advisor-edit', { title: a.name, a, provinces: geo.provinces, CATEGORIES, LANGS });
});
router.post('/advisors', auth.requireRole('editor'), (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.redirect(303, '/admin/advisors?_err=' + encodeURIComponent('Photo upload failed (max 5 MB).'));
    const b = req.body;
    // licences: one per line "PROV | Regulator | Licence type | Number | Expiry"
    const licences = String(b.licences || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0])
      .map(([province, regulator, type, number, expires]) => ({ province: province.toLowerCase(), regulator, type, number, expires }));
    const row = {
      name: String(b.name || '').trim().slice(0, 100), title: b.title, designations: b.designations, email: b.email || null, phone: b.phone || null, booking_url: /^https:\/\//.test(b.booking_url || '') ? b.booking_url : null,
      bio_md: b.bio_md, languages: arr(b.languages), provinces: arr(b.provinces).filter((c) => geo.provinceByCode[c]), categories: arr(b.categories).filter((c) => CATEGORIES[c]), specialties: arr(b.specialties).filter((d) => deskBySlug[d]), licences,
      years_experience: Number(b.years_experience) || null, active: b.active ? 1 : 0, accepting_leads: b.accepting_leads ? 1 : 0, weight: Math.max(1, Number(b.weight) || 1),
      max_open_leads: Number(b.max_open_leads) || null, is_demo: b.is_demo ? 1 : 0, updated_at: sqlNow(),
    };
    if (!row.name) return res.redirect(303, '/admin/advisors/new?_err=Name+required');
    if (req.file) {
      try { row.photo = media.save(req.file.buffer, { originalName: req.file.originalname, alt: row.name, userId: req.user.id }).url; } catch (e) { return res.redirect(303, '/admin/advisors?_err=' + encodeURIComponent(e.message)); }
    } else if (b.photo_url !== undefined) row.photo = String(b.photo_url || '').startsWith('/uploads/') ? b.photo_url : null;
    let id = Number(b.id) || null;
    if (id) db.update('advisors', id, row);
    else {
      let slug = slugify(row.name); let i = 1;
      while (db.get('SELECT id FROM advisors WHERE slug = ?', [slug])) slug = `${slugify(row.name)}-${++i}`;
      id = db.insert('advisors', { ...row, slug });
    }
    purge();
    res.locals.audit(b.id ? 'update' : 'create', 'advisor', id, { name: row.name });
    res.redirect(303, `/admin/advisors/${id}?_ok=Saved`);
  });
});

// ───────────── Geo verification & overrides ─────────────
router.get('/geo', auth.requireRole('editor'), (req, res) => {
  const ov = Object.fromEntries(db.all('SELECT * FROM geo_overrides').map((r) => [r.key, r]));
  res.admin('geo', { title: 'Provinces & cities', provinces: geo.provinces, citiesByProv: geo.citiesByProv, ov });
});
router.get('/geo/edit', auth.requireRole('editor'), (req, res, next) => {
  const key = String(req.query.key || '');
  const [pc, cs] = key.split('/');
  const base = cs ? geo.cityByKey[key] : geo.provinceByCode[pc];
  if (!base) return next();
  const ov = db.get('SELECT * FROM geo_overrides WHERE key = ?', [key]);
  const merged = cs ? pages.city(pc, cs) : pages.province(pc);
  res.admin('geo-edit', { title: `Geo: ${base.name}`, key, base, merged, ov, isCity: !!cs });
});
router.post('/geo/edit', auth.requireRole('editor'), (req, res) => {
  const b = req.body; const key = String(b.key || '');
  const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const data = {};
  if (b.risks !== undefined) data.risks = lines(b.risks);
  if (b.autoNotes !== undefined && b.autoNotes.trim()) data.autoNotes = lines(b.autoNotes);
  if (b.events2026 !== undefined) data.events2026 = lines(b.events2026);
  if (b.sources !== undefined) data.sources = lines(b.sources).filter((u) => /^https?:\/\//.test(u));
  if (b.autoFactor) data.autoFactor = Number(b.autoFactor);
  if (b.tier) data.tier = Number(b.tier);
  if (b.benchmarks) { try { data.benchmarks = JSON.parse(b.benchmarks); } catch { return res.redirect(303, `/admin/geo/edit?key=${encodeURIComponent(key)}&_err=Benchmarks+must+be+valid+JSON`); } }
  const verified = b.verified ? sqlNow() : null;
  db.run(`INSERT INTO geo_overrides(key, data, verified_at, verified_by, updated_at) VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, verified_at = excluded.verified_at, verified_by = excluded.verified_by, updated_at = CURRENT_TIMESTAMP`, [key, JSON.stringify(data), verified, verified ? req.user.id : null]);
  purge();
  res.locals.audit('update', 'geo', key, { verified: !!verified });
  res.redirect(303, `/admin/geo/edit?key=${encodeURIComponent(key)}&_ok=Saved`);
});

// ───────────── Products ─────────────
router.get('/products', auth.requireRole('admin'), (req, res) => {
  const ov = Object.fromEntries(db.all('SELECT * FROM product_overrides').map((r) => [r.slug, r]));
  const stats = Object.fromEntries(db.all("SELECT product, COUNT(*) n, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) won FROM leads WHERE is_test = 0 GROUP BY product").map((r) => [r.product, r]));
  res.admin('products', { title: 'Products', products, ov, stats, CATEGORIES });
});
router.post('/products', auth.requireRole('admin'), (req, res) => {
  const enabled = new Set(arr(req.body.enabled));
  db.tx(() => {
    for (const p of products) {
      const lv = req.body[`lv_${p.slug}`];
      db.run(`INSERT INTO product_overrides(slug, enabled, lead_value, updated_at) VALUES(?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(slug) DO UPDATE SET enabled = excluded.enabled, lead_value = excluded.lead_value, updated_at = CURRENT_TIMESTAMP`, [p.slug, enabled.has(p.slug) ? 1 : 0, lv ? Number(lv) : null]);
      if (lv) bySlug[p.slug].leadValue = Number(lv);
    }
  });
  purge();
  res.locals.audit('update', 'products', '', { enabled: [...enabled] });
  res.redirect(303, '/admin/products?_ok=Saved');
});

// ───────────── Scoring rules ─────────────
router.get('/scoring', auth.requireRole('admin'), (req, res) => {
  const rules = db.all('SELECT * FROM scoring_rules ORDER BY category, sort, id');
  const dist = db.all("SELECT grade, COUNT(*) n FROM leads WHERE is_test = 0 GROUP BY grade ORDER BY grade");
  res.admin('scoring', { title: 'Lead scoring', rules, FIELDS: scoring.FIELDS, OPS: Object.keys(scoring.OPERATORS), dist, threshold: settings.get('hot_lead_threshold') });
});
router.post('/scoring', auth.requireRole('admin'), (req, res) => {
  const b = req.body;
  const row = { name: String(b.name || '').slice(0, 120), category: ['fit', 'intent', 'quality', 'engagement'].includes(b.category) ? b.category : 'fit', field: String(b.field || ''), operator: scoring.OPERATORS[b.operator] ? b.operator : 'eq', value: String(b.value || ''), points: Math.max(-100, Math.min(100, Number(b.points) || 0)), active: b.active ? 1 : 0, sort: Number(b.sort) || 0 };
  if (!row.name || !row.field) return res.redirect(303, '/admin/scoring?_err=Name+and+field+required');
  if (b.id) db.update('scoring_rules', Number(b.id), row); else db.insert('scoring_rules', row);
  scoring.invalidate();
  res.locals.audit('save', 'scoring_rule', b.id || 'new', row);
  res.redirect(303, '/admin/scoring?_ok=Rule+saved');
});
router.post('/scoring/:id/delete', auth.requireRole('admin'), (req, res) => { db.run('DELETE FROM scoring_rules WHERE id = ?', [Number(req.params.id)]); scoring.invalidate(); res.redirect(303, '/admin/scoring?_ok=Deleted'); });
router.post('/scoring/rescore', auth.requireRole('admin'), (req, res) => {
  const ids = db.all("SELECT id FROM leads WHERE created_at >= datetime('now','-180 days')").map((r) => r.id);
  for (const id of ids) scoring.rescore(id, 'rules changed');
  res.redirect(303, `/admin/scoring?_ok=${ids.length}+leads+re-scored`);
});

// ───────────── Users ─────────────
router.get('/users', auth.requireRole('admin'), (req, res) => res.admin('users', { title: 'Users & roles', rows: db.all('SELECT u.*, a.name AS advisor_name FROM users u LEFT JOIN advisors a ON a.id = u.advisor_id ORDER BY u.active DESC, u.name'), advisors: db.all('SELECT id, name FROM advisors ORDER BY name'), ROLES: Object.keys(auth.ROLES) }));
router.post('/users', auth.requireRole('admin'), (req, res) => {
  const b = req.body;
  const row = { name: String(b.name || '').slice(0, 100), email: String(b.email || '').trim().toLowerCase(), role: auth.ROLES[b.role] ? b.role : 'viewer', advisor_id: Number(b.advisor_id) || null, active: b.active ? 1 : 0 };
  if (!row.name || !/^[^@\s]+@[^@\s]+$/.test(row.email)) return res.redirect(303, '/admin/users?_err=Name+and+valid+email+required');
  if (b.password && String(b.password).length < 12) return res.redirect(303, '/admin/users?_err=Passwords+need+12%2B+characters');
  if (b.id) {
    if (Number(b.id) === req.user.id && (row.role !== 'admin' || !row.active)) return res.redirect(303, '/admin/users?_err=You+cannot+demote+or+deactivate+yourself');
    db.update('users', Number(b.id), { ...row, password_hash: b.password ? auth.hashPassword(b.password) : undefined });
    if (!row.active || b.password) db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [Number(b.id), req.session.id]);
  } else {
    if (!b.password) return res.redirect(303, '/admin/users?_err=Password+required+for+new+users');
    try { db.insert('users', { ...row, password_hash: auth.hashPassword(b.password) }); } catch { return res.redirect(303, '/admin/users?_err=That+email+already+has+an+account'); }
  }
  res.locals.audit('save', 'user', b.id || row.email, { role: row.role });
  res.redirect(303, '/admin/users?_ok=User+saved');
});

router.get('/audit', auth.requireRole('admin'), (req, res) => res.admin('audit', { title: 'Audit log', rows: db.all('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300') }));

module.exports = router;
