'use strict';
/**
 * Agents (the routing pool and E-E-A-T advisor profiles), approvals, monthly caps, performance,
 * lead distribution settings and the daily report. Admins, agent managers and editors manage agents;
 * the daily report page is for admins and agent managers.
 */
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const auth = require('../../lib/auth');
const settings = require('../../lib/settings');
const media = require('../../lib/media');
const agents = require('../../lib/agents');
const routing = require('../../lib/routing');
const reports = require('../../lib/reports');
const stages = require('../../lib/stages');
const cache = require('../../lib/cache');
const pages = require('../../lib/pages');
const seo = require('../../lib/seo');
const { CATEGORIES } = require('../../data/products');
const geo = require('../../data/geo');
const { slugify, arr, sqlNow, monthStartUtc, isEmail } = require('../../lib/util');
const { deskBySlug, DESKS } = require('../../lib/specialties');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: media.MAX_BYTES + 1, files: 1 } });
const LANGS = { en: 'English', fr: 'French', pa: 'Punjabi', hi: 'Hindi', zh: 'Chinese', tl: 'Tagalog', ar: 'Arabic', es: 'Spanish', ur: 'Urdu', ta: 'Tamil', gu: 'Gujarati' };
const STATUSES = { approved: 'Approved', pending: 'Pending approval', suspended: 'Suspended', rejected: 'Rejected' };

function purge() { cache.clear(); pages.invalidate(); seo.clearOverrides(); try { require('../system').clearMemo(); } catch { /* ignore */ } }
const manage = auth.requirePerm('agents.manage');

// ───────────── Agent list, approvals and caps ─────────────
router.get('/advisors', manage, (req, res) => {
  const status = STATUSES[req.query.status] ? req.query.status : 'approved';
  const m0 = monthStartUtc(0);
  const rows = db.all(`SELECT a.*, (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status IN ${stages.OPEN_SQL}) open_leads,
      (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status = 'won') won,
      (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id) total_leads,
      (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.assigned_at >= ?) month_count,
      (SELECT COUNT(*) FROM users u WHERE u.advisor_id = a.id) has_login
    FROM advisors a WHERE COALESCE(a.status, 'approved') = ? ORDER BY a.active DESC, a.is_demo, a.name`, [m0, status]);
  const counts = Object.fromEntries(db.all("SELECT COALESCE(status,'approved') s, COUNT(*) n FROM advisors GROUP BY s").map((r) => [r.s, r.n]));
  const live = db.all("SELECT provinces FROM advisors WHERE active = 1 AND is_demo = 0 AND COALESCE(status,'approved') = 'approved'");
  const coverage = geo.provinces.map((p) => ({ p, n: live.filter((a) => db.json(a.provinces, []).includes(p.code)).length }));
  res.admin('advisors', { title: 'Agents', rows, coverage, CATEGORIES, tab: status, STATUSES, counts, mode: settings.get('assignment_mode'), MODES: routing.MODES, defaultCap: settings.get('default_monthly_cap') });
});

router.post('/advisors/:id/status', manage, async (req, res) => {
  const status = STATUSES[req.body.status] ? req.body.status : null;
  if (!status) return res.redirect(303, '/admin/advisors?_err=Unknown+status');
  const a = agents.setStatus(Number(req.params.id), status, { userId: req.user.id });
  if (!a) return res.redirect(303, '/admin/advisors?_err=Agent+not+found');
  res.locals.audit(status, 'advisor', a.id, { name: a.name });
  if (req.body.notify !== '0') agents.notifyDecision(a, status).catch(() => {});
  purge();
  res.redirect(303, `${String(req.body.back || '').startsWith('/admin/') ? req.body.back : '/admin/advisors?status=pending'}${String(req.body.back || '').includes('?') ? '&' : '?'}_ok=${encodeURIComponent(`${a.name}: ${STATUSES[status].toLowerCase()}`)}`);
});

/** Change a monthly cap from the list (blank = no limit). */
router.post('/advisors/:id/cap', manage, (req, res) => {
  const a = db.get('SELECT id, name, monthly_lead_cap FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return res.redirect(303, '/admin/advisors?_err=Agent+not+found');
  const raw = String(req.body.monthly_lead_cap ?? '').trim();
  const cap = raw === '' ? null : Math.max(0, Math.min(10000, Math.round(Number(raw) || 0)));
  db.update('advisors', a.id, { monthly_lead_cap: cap, updated_at: sqlNow() });
  res.locals.audit('cap', 'advisor', a.id, { from: a.monthly_lead_cap, to: cap });
  res.redirect(303, `/admin/advisors?status=${encodeURIComponent(req.body.status || 'approved')}&_ok=${encodeURIComponent(`${a.name}: ${cap === null ? 'no monthly limit' : `${cap} leads a month`}`)}`);
});

router.get('/advisors/new', manage, (req, res) => res.admin('advisor-edit', { title: 'New agent', a: { languages: '["en"]', provinces: '[]', categories: '[]', specialties: '[]', licences: '[]', active: 1, accepting_leads: 1, weight: 1, max_open_leads: 150, status: 'approved', show_on_site: 1, monthly_lead_cap: null }, login: null, provinces: geo.provinces, CATEGORIES, LANGS, STATUSES, monthCount: 0 }));
router.get('/advisors/:id', manage, (req, res, next) => {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return next();
  const login = db.get('SELECT id, email, active, last_login_at FROM users WHERE advisor_id = ? ORDER BY id LIMIT 1', [a.id]);
  res.admin('advisor-edit', { title: a.name, a, login, provinces: geo.provinces, CATEGORIES, LANGS, STATUSES, monthCount: routing.monthCount(a.id) });
});
router.get('/advisors/:id/performance', manage, (req, res, next) => {
  const a = db.get('SELECT id FROM advisors WHERE id = ?', [Number(req.params.id)]);
  if (!a) return next();
  res.admin('performance', { title: 'Agent performance', p: agents.performance(a.id), stages, own: false });
});

router.post('/advisors', manage, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.redirect(303, '/admin/advisors?_err=' + encodeURIComponent('Photo upload failed (max 5 MB).'));
    const b = req.body;
    // licences: one per line "PROV | Regulator | Licence type | Number | Expiry"
    const licences = String(b.licences || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0])
      .map(([province, regulator, type, number, expires]) => ({ province: province.toLowerCase(), regulator, type, number, expires }));
    const capRaw = String(b.monthly_lead_cap ?? '').trim();
    const row = {
      name: String(b.name || '').trim().slice(0, 100), title: b.title, designations: b.designations, email: b.email || null, phone: b.phone || null, booking_url: /^https:\/\//.test(b.booking_url || '') ? b.booking_url : null,
      bio_md: b.bio_md, languages: arr(b.languages), provinces: arr(b.provinces).filter((c) => geo.provinceByCode[c]), categories: arr(b.categories).filter((c) => CATEGORIES[c]), specialties: arr(b.specialties).filter((d) => deskBySlug[d]), licences,
      licence_number: String(b.licence_number || '').trim().slice(0, 40) || null,
      years_experience: Number(b.years_experience) || null, active: b.active ? 1 : 0, accepting_leads: b.accepting_leads ? 1 : 0, weight: Math.max(1, Number(b.weight) || 1),
      max_open_leads: Number(b.max_open_leads) || null, is_demo: b.is_demo ? 1 : 0, show_on_site: b.show_on_site ? 1 : 0,
      monthly_lead_cap: capRaw === '' ? null : Math.max(0, Math.min(10000, Math.round(Number(capRaw) || 0))),
      status: STATUSES[b.status] ? b.status : 'approved', updated_at: sqlNow(),
    };
    if (!row.name) return res.redirect(303, '/admin/advisors/new?_err=Name+required');
    if (row.status !== 'approved') row.active = 0;
    if (req.file) {
      try { row.photo = media.save(req.file.buffer, { originalName: req.file.originalname, alt: row.name, userId: req.user.id }).url; } catch (e) { return res.redirect(303, '/admin/advisors?_err=' + encodeURIComponent(e.message)); }
    } else if (b.photo_url !== undefined) row.photo = String(b.photo_url || '').startsWith('/uploads/') ? b.photo_url : null;
    let id = Number(b.id) || null;
    if (id) {
      const before = db.get('SELECT status, approved_at FROM advisors WHERE id = ?', [id]);
      if (row.status === 'approved' && before && !before.approved_at) Object.assign(row, { approved_at: sqlNow(), approved_by: req.user.id });
      db.update('advisors', id, row);
      if (before && before.status !== row.status) agents.setStatus(id, row.status, { userId: req.user.id });
    } else {
      let slug = slugify(row.name); let i = 1;
      while (db.get('SELECT id FROM advisors WHERE slug = ?', [slug])) slug = `${slugify(row.name)}-${++i}`;
      id = db.insert('advisors', { ...row, slug, approved_at: row.status === 'approved' ? sqlNow() : null, approved_by: row.status === 'approved' ? req.user.id : null });
    }
    purge();
    res.locals.audit(b.id ? 'update' : 'create', 'advisor', id, { name: row.name, cap: row.monthly_lead_cap, status: row.status });
    res.redirect(303, `/admin/advisors/${id}?_ok=Saved`);
  });
});

// ───────────── Lead distribution ─────────────
router.get('/distribution', manage, (req, res) => {
  const pool = db.all("SELECT id, name, provinces, categories, monthly_lead_cap, last_assigned_at, active, accepting_leads FROM advisors WHERE COALESCE(status,'approved') = 'approved' AND active = 1 ORDER BY name");
  const m0 = monthStartUtc(0);
  for (const a of pool) a.month_count = db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND assigned_at >= ?', [a.id, m0]) || 0;
  const unassigned = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id IS NULL AND status IN ${stages.OPEN_SQL} AND is_test = 0 AND lead_type NOT IN ('partial','newsletter')`) || 0;
  res.admin('distribution', { title: 'Lead distribution', st: settings.all(), MODES: routing.MODES, pool, unassigned, provinces: geo.provinces, CATEGORIES, DESKS });
});
router.post('/distribution', manage, (req, res) => {
  const b = req.body;
  const rules = [];
  const rp = arr(b.rule_province), rc = arr(b.rule_category), rs = arr(b.rule_service), ra = arr(b.rule_advisor);
  for (let i = 0; i < ra.length; i++) {
    if (!Number(ra[i])) continue;
    rules.push({ province: geo.provinceByCode[rp[i]] ? rp[i] : '', category: CATEGORIES[rc[i]] ? rc[i] : '', service: deskBySlug[rs[i]] ? rs[i] : '', advisor_id: Number(ra[i]) });
  }
  const capRaw = String(b.default_monthly_cap ?? '').trim();
  const patch = {
    assignment_mode: routing.MODES[b.assignment_mode] ? b.assignment_mode : 'best_match',
    assignment_rules: rules,
    default_monthly_cap: capRaw === '' ? null : Math.max(0, Math.round(Number(capRaw) || 0)),
    agent_registration_open: b.agent_registration_open === 'on',
    require_note_on_new: b.require_note_on_new === 'on',
    lead_match_phone: b.lead_match_phone === 'on',
    lead_merge_days: Math.max(0, Math.round(Number(b.lead_merge_days) || 0)),
  };
  settings.setMany(patch);
  res.locals.audit('update', 'distribution', '', patch);
  res.redirect(303, '/admin/distribution?_ok=Saved');
});
/** Run automatic assignment over every unassigned open lead (respects licences and caps). */
router.post('/distribution/run', manage, (req, res) => {
  const mode = settings.get('assignment_mode') === 'manual' ? 'best_match' : undefined;
  const list = db.all(`SELECT * FROM leads WHERE advisor_id IS NULL AND status IN ${stages.OPEN_SQL} AND is_test = 0 AND lead_type NOT IN ('partial','newsletter') ORDER BY created_at LIMIT 500`);
  let n = 0;
  for (const l of list) if (routing.assign(l, { userId: req.user.id, mode })) { n++; require('../../lib/leads').notifyAssignee(l.id, { by: req.user.name }).catch(() => {}); }
  res.locals.audit('assign', 'leads', 'distribution-run', { assigned: n, of: list.length });
  res.redirect(303, `/admin/distribution?_ok=${encodeURIComponent(`Assigned ${n} of ${list.length} unassigned lead${list.length === 1 ? '' : 's'}${n < list.length ? ' (the rest have no eligible agent: licence, province, product or monthly cap)' : ''}`)}`);
});

// ───────────── Daily report ─────────────
router.get('/reports/daily', auth.requirePerm('reports'), (req, res) => {
  const r = reports.build();
  const { subject, bodyMd } = reports.render(r);
  res.admin('report', { title: 'Daily lead report', subject, html: require('../../lib/markdown').render(bodyMd).html, recipients: reports.recipients(), st: settings.all(), smtpOn: !!require('../../config').smtp });
});
router.post('/reports/daily/send', auth.requirePerm('reports'), async (req, res) => {
  const out = await reports.sendDaily();
  res.redirect(303, `/admin/reports/daily?_ok=${encodeURIComponent(out.to.length ? `Sent to ${out.to.length} recipient${out.to.length === 1 ? '' : 's'} (${out.results.map((r) => r.status).filter((v, i, a) => a.indexOf(v) === i).join(', ')})` : 'No recipients: tick “Daily lead report” on a user, or add extra recipients')}`);
});
router.post('/reports/daily/settings', auth.requirePerm('reports'), (req, res) => {
  const extra = String(req.body.report_extra_emails || '').split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter((e) => isEmail(e));
  settings.setMany({ daily_report_hour: Math.min(23, Math.max(0, Math.round(Number(req.body.daily_report_hour) || 7))), report_extra_emails: extra });
  res.redirect(303, '/admin/reports/daily?_ok=Saved');
});

module.exports = router;
module.exports.LANGS = LANGS;
