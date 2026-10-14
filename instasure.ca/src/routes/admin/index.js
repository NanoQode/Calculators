'use strict';
/**
 * Admin back office. Server-rendered (no SPA), CSRF-protected, role-based:
 *   viewer < advisor (own leads) < editor (content & SEO) < admin (everything).
 */
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const settings = require('../../lib/settings');
const charts = require('../../lib/charts');
const { sqlNow, num, money } = require('../../lib/util');

const router = express.Router();

// Every admin response: never cache, never index.
router.use((req, res, next) => { res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }); next(); });

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/admin/');
  res.render('admin/login', { error: null, next: String(req.query.next || '/admin/'), email: '' });
});
router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const r = auth.login(email, String(req.body.password || ''), req);
  if (r.error) return res.status(401).render('admin/login', { error: r.error, next: String(req.body.next || '/admin/'), email });
  res.cookie(auth.COOKIE, r.sessionId, auth.cookieOptions());
  db.insert('audit_log', { user_id: r.user.id, action: 'login', entity: 'user', entity_id: String(r.user.id) });
  const next = String(req.body.next || '/admin/');
  res.redirect(next.startsWith('/admin') ? next : '/admin/');
});

router.use(auth.requireUser);
router.use(auth.csrf);

router.post('/logout', (req, res) => { auth.logout(req, res); res.redirect('/admin/login'); });

// Shared admin helpers
router.use((req, res, next) => {
  res.locals.layout = 'admin';
  res.locals.can = (role) => auth.can(req.user, role);
  res.locals.db_json = (v, d) => db.json(v, d === undefined ? {} : d);
  res.locals.audit = (action, entity, id, data) => db.insert('audit_log', { user_id: req.user.id, action, entity, entity_id: String(id || ''), data: data || {} });
  res.admin = (view, data = {}) => res.page(`admin/${view}`, { layout: 'admin', noCache: true, ...data });
  res.locals.counts = {
    newLeads: req.user.role === 'advisor'
      ? db.value("SELECT COUNT(*) FROM leads WHERE status = 'new' AND advisor_id = ?", [req.user.advisor_id || -1])
      : db.value("SELECT COUNT(*) FROM leads WHERE status = 'new' AND is_test = 0"),
    drafts: db.value("SELECT COUNT(*) FROM posts WHERE status = 'draft'"),
  };
  next();
});

function launchChecklist() {
  const s = settings.all();
  const items = [
    { ok: !!s.legal_name, label: 'Legal entity name set (CASL sender identification)', href: '/admin/settings#identity' },
    { ok: !!s.mailing_address, label: 'Mailing address set (required in every commercial email under CASL)', href: '/admin/settings#identity' },
    { ok: !!s.privacy_officer, label: 'Privacy officer named (PIPEDA / Quebec Law 25)', href: '/admin/settings#identity' },
    { ok: !settings.phoneIsPlaceholder(s.phone), label: 'Customer service number replaced (the site shows the 1-800-000-0000 placeholder)', href: '/admin/settings#identity' },
    { ok: !db.value('SELECT COUNT(*) FROM advisors WHERE is_demo = 1 AND active = 1'), label: 'Sample advisors replaced with real licensed advisors', href: '/admin/advisors' },
    { ok: db.value("SELECT COUNT(*) FROM advisors WHERE is_demo = 0 AND active = 1 AND licences LIKE '%number%'") > 0, label: 'At least one advisor with licence numbers entered', href: '/admin/advisors' },
    (() => {
      const staffed = new Set(db.all('SELECT specialties FROM advisors WHERE active = 1 AND is_demo = 0').flatMap((a) => db.json(a.specialties, [])));
      const desks = require('../../lib/specialties').DESKS;
      const n = desks.filter((d) => staffed.has(d.slug)).length;
      return { ok: n === desks.length, label: `Specialist desks staffed by real advisors (${n} of ${desks.length})`, href: '/admin/advisors' };
    })(),
    { ok: !!require('../../config').smtp, label: 'SMTP configured (SMTP_HOST in .env) so emails actually send', href: '/admin/emails' },
    { ok: !!s.gsc_verification || !!s.ga4_id, label: 'Google Search Console / GA4 connected', href: '/admin/settings#analytics' },
    { ok: !!s.bing_verification, label: 'Bing Webmaster Tools verified (feeds ChatGPT search & Copilot)', href: '/admin/settings#analytics' },
    { ok: db.value("SELECT COUNT(*) FROM posts WHERE status = 'published' AND reviewer_id IS NOT NULL") > 0, label: 'Guides reviewed by a licensed advisor (E-E-A-T)', href: '/admin/posts' },
    { ok: db.value('SELECT COUNT(*) FROM geo_overrides WHERE verified_at IS NOT NULL') > 0, label: 'Province facts verified by a licensed team member', href: '/admin/geo' },
    { ok: !!s.carriers_confirmed, label: 'Insurer and MGA appointments and logo permissions confirmed (logos hidden until then)', href: '/admin/partners' },
    { ok: !!require('../../config').indexNowEnabled, label: 'IndexNow enabled in production (INDEXNOW_ENABLED=true)', href: '/admin/seo' },
  ];
  return { items, done: items.filter((i) => i.ok).length };
}

function daysSeries(sql, params, days) {
  const rows = db.all(sql, params);
  const map = Object.fromEntries(rows.map((r) => [r.d, r.n]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: key, short: d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), value: map[key] || 0 });
  }
  return out;
}

router.get('/', (req, res) => {
  const days = 30;
  const since = `-${days} days`;
  const advisorScope = req.user.role === 'advisor' ? ' AND advisor_id = ' + Number(req.user.advisor_id || -1) : '';
  const k = db.get(`SELECT COUNT(*) total,
      SUM(CASE WHEN created_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) today,
      SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) hot,
      ROUND(AVG(score)) avg_score,
      SUM(value_estimate) pipeline,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) won
    FROM leads WHERE is_test = 0 AND created_at >= datetime('now', ?)${advisorScope}`, [since]);
  const sessions = db.value("SELECT COUNT(DISTINCT session_id) FROM pageviews WHERE session_id IS NOT NULL AND ts >= datetime('now', ?)", [since]) || 0;
  const pv = db.value("SELECT COUNT(*) FROM pageviews WHERE ts >= datetime('now', ?)", [since]) || 0;
  const leadsByDay = daysSeries(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM leads WHERE is_test = 0 AND created_at >= datetime('now', ?)${advisorScope} GROUP BY d`, [since], days);
  const hot = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id WHERE l.is_test = 0 AND l.status IN ('new','contacted') ${advisorScope.replace('advisor_id', 'l.advisor_id')} ORDER BY l.score DESC, l.created_at DESC LIMIT 8`);
  const byProduct = db.all(`SELECT COALESCE(product,'(none)') label, COUNT(*) value FROM leads WHERE is_test = 0 AND created_at >= datetime('now', ?)${advisorScope} GROUP BY product ORDER BY value DESC LIMIT 8`, [since]);
  const bySource = db.all(`SELECT COALESCE(source,'direct') label, COUNT(*) value FROM leads WHERE is_test = 0 AND created_at >= datetime('now', ?)${advisorScope} GROUP BY source ORDER BY value DESC`, [since]);
  const crawlers = db.all("SELECT bot label, COUNT(*) value FROM crawler_hits WHERE kind LIKE 'ai_%' AND ts >= datetime('now', ?) GROUP BY bot ORDER BY value DESC LIMIT 6", [since]);
  const unassigned = db.value("SELECT COUNT(*) FROM leads WHERE advisor_id IS NULL AND status = 'new' AND is_test = 0") || 0;
  const dripDue = db.value("SELECT COUNT(*) FROM enrollments WHERE status = 'active'") || 0;
  res.admin('dashboard', {
    title: 'Dashboard', k, sessions, pv, unassigned, dripDue,
    cvr: sessions ? ((k.total || 0) / sessions) * 100 : 0,
    leadsChart: charts.bars(leadsByDay, { label: 'Leads' }), leadsByDay,
    productBars: charts.hbars(byProduct), sourceBars: charts.hbars(bySource), crawlerBars: charts.hbars(crawlers),
    hot, checklist: launchChecklist(), num, money,
  });
});

router.use(require('./leads'));
router.use(require('./campaigns'));
router.use(require('./content'));
router.use(require('./seo'));
router.use(require('./analytics'));
router.use(require('./site'));

module.exports = router;
module.exports.launchChecklist = launchChecklist;
module.exports.daysSeries = daysSeries;
