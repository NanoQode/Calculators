'use strict';
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const leadsSvc = require('../../lib/leads');
const scoring = require('../../lib/scoring');
const routing = require('../../lib/routing');
const drip = require('../../lib/drip');
const mailer = require('../../lib/mailer');
const { bySlug, products } = require('../../data/products');
const geo = require('../../data/geo');
const { csvCell, sqlNow } = require('../../lib/util');

const router = express.Router();
const PAGE = 50;

/** Advisors only see their own leads. */
function scope(req) {
  return req.user.role === 'advisor' ? { sql: ' AND l.advisor_id = ?', params: [req.user.advisor_id || -1] } : { sql: '', params: [] };
}
function canSee(req, lead) { return lead && (req.user.role !== 'advisor' || lead.advisor_id === req.user.advisor_id); }

function filters(req) {
  const q = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (q.status) { where += ' AND l.status = ?'; params.push(q.status); }
  if (q.grade) { where += ' AND l.grade = ?'; params.push(q.grade); }
  if (q.product) { where += ' AND l.product = ?'; params.push(q.product); }
  if (q.province) { where += ' AND l.province = ?'; params.push(q.province); }
  if (q.source) { where += ' AND l.source = ?'; params.push(q.source); }
  if (q.type) { where += ' AND l.lead_type = ?'; params.push(q.type); }
  if (q.advisor === 'none') where += ' AND l.advisor_id IS NULL';
  else if (q.advisor) { where += ' AND l.advisor_id = ?'; params.push(Number(q.advisor)); }
  if (q.from) { where += ' AND l.created_at >= ?'; params.push(q.from); }
  if (q.to) { where += " AND l.created_at < date(?, '+1 day')"; params.push(q.to); }
  if (!q.tests) where += ' AND l.is_test = 0';
  if (q.q) {
    const like = `%${String(q.q).trim()}%`;
    where += ' AND (l.email LIKE ? OR l.first_name LIKE ? OR l.last_name LIKE ? OR l.phone LIKE ? OR l.ref LIKE ?)';
    params.push(like, like, like, like, like);
  }
  const s = scope(req);
  return { where: where + s.sql, params: [...params, ...s.params] };
}

const SORTS = { newest: 'l.created_at DESC', score: 'l.score DESC, l.created_at DESC', oldest: 'l.created_at ASC', value: 'l.value_estimate DESC' };

router.get('/leads', (req, res) => {
  const f = filters(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const total = db.value(`SELECT COUNT(*) FROM leads l${f.where}`, f.params);
  const rows = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id${f.where} ORDER BY ${sort} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, f.params);
  const statusCounts = db.all(`SELECT l.status, COUNT(*) n FROM leads l${f.where.replace(/ AND l\.status = \?/, '')} GROUP BY l.status`, f.params.filter((p, i) => !(req.query.status && i === 0)));
  res.admin('leads', {
    title: 'Leads', rows, total, page, pages: Math.ceil(total / PAGE), q: req.query, statusCounts,
    advisors: db.all('SELECT id, name FROM advisors ORDER BY name'), products, provinces: geo.provinces, STATUSES: leadsSvc.STATUSES, bySlug,
  });
});

router.get('/leads.csv', auth.requireRole('editor'), (req, res) => {
  const f = filters(req);
  const rows = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id${f.where} ORDER BY l.created_at DESC LIMIT 50000`, f.params);
  const cols = ['ref', 'created_at', 'status', 'lead_type', 'grade', 'score', 'first_name', 'last_name', 'email', 'phone', 'province', 'city', 'postal_code', 'language', 'product', 'timeframe', 'best_time', 'advisor_name', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'landing_page', 'consent_marketing', 'consent_at', 'unsubscribed_at', 'value_estimate'];
  res.locals.audit('export', 'leads', '', { count: rows.length });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="instasure-leads-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'));
});

router.get('/pipeline', (req, res) => {
  const s = scope(req);
  const cols = ['new', 'contacted', 'quoted', 'application', 'won'];
  const board = {};
  for (const st of cols) {
    board[st] = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id WHERE l.status = ? AND l.is_test = 0${s.sql} ORDER BY l.score DESC, l.created_at DESC LIMIT 60`, [st, ...s.params]);
  }
  const totals = Object.fromEntries(cols.map((c) => [c, db.value(`SELECT COUNT(*) FROM leads l WHERE l.status = ? AND l.is_test = 0${s.sql}`, [c, ...s.params])]));
  res.admin('pipeline', { title: 'Pipeline', board, cols, totals, bySlug });
});

router.get('/leads/:id', (req, res, next) => {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [Number(req.params.id)]);
  if (!canSee(req, lead)) return next();
  const events = db.all('SELECT e.*, u.name AS user_name FROM lead_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.lead_id = ? ORDER BY e.id DESC LIMIT 200', [lead.id]);
  const emails = db.all('SELECT id, kind, subject, status, sent_at, open_count, click_count, created_at FROM emails WHERE lead_id = ? ORDER BY id DESC', [lead.id]);
  const enrollments = db.all('SELECT e.*, c.name FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id WHERE e.lead_id = ? ORDER BY e.id DESC', [lead.id]);
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const related = db.all('SELECT id, ref, product, status, created_at FROM leads WHERE email = ? AND id != ? ORDER BY id DESC LIMIT 10', [lead.email, lead.id]);
  const facts = scoring.buildFacts(lead, scoring.engagementFor(lead));
  const pageviews = lead.visitor_id ? db.all('SELECT path, ts FROM pageviews WHERE visitor_id = ? ORDER BY id DESC LIMIT 30', [lead.visitor_id]) : [];
  res.admin('lead', {
    title: `Lead ${lead.ref}`, lead, events, emails, enrollments, advisor, related, facts, pageviews,
    product: bySlug[lead.product], prov: geo.provinceByCode[lead.province],
    inputs: db.json(lead.quote_inputs, {}), estimate: db.json(lead.estimate, {}), breakdown: db.json(lead.score_breakdown, []),
    advisors: db.all('SELECT id, name, provinces, categories, is_demo FROM advisors WHERE active = 1 ORDER BY name'),
    campaigns: db.all('SELECT id, name FROM campaigns WHERE active = 1 ORDER BY name'),
    candidates: routing.candidates(lead).map((a) => a.id),
    STATUSES: leadsSvc.STATUSES,
  });
});

function back(req, res, msg, err) {
  const base = `/admin/leads/${req.params.id}`;
  res.redirect(303, `${base}?${err ? '_err' : '_ok'}=${encodeURIComponent(msg)}`);
}
function load(req) { const l = db.get('SELECT * FROM leads WHERE id = ?', [Number(req.params.id)]); return canSee(req, l) ? l : null; }

router.post('/leads/:id/status', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  try { leadsSvc.setStatus(lead.id, String(req.body.status), { userId: req.user.id, reason: req.body.reason }); } catch (e) { return back(req, res, e.message, true); }
  if (req.body.return === 'pipeline') return res.redirect(303, '/admin/pipeline');
  back(req, res, `Status set to ${req.body.status}`);
});

router.post('/leads/:id/note', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const note = String(req.body.note || '').trim().slice(0, 4000);
  if (note) db.insert('lead_events', { lead_id: lead.id, type: 'note', user_id: req.user.id, data: { note } });
  back(req, res, 'Note added');
});

router.post('/leads/:id/call', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  db.insert('lead_events', { lead_id: lead.id, type: 'call', user_id: req.user.id, data: { outcome: String(req.body.outcome || '').slice(0, 60), note: String(req.body.note || '').slice(0, 1000) } });
  if (lead.status === 'new') leadsSvc.setStatus(lead.id, 'contacted', { userId: req.user.id });
  back(req, res, 'Call logged');
});

router.post('/leads/:id/assign', auth.requireRole('editor'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  if (req.body.advisor_id === 'auto') {
    db.run('UPDATE leads SET advisor_id = NULL WHERE id = ?', [lead.id]);
    const a = routing.assign({ ...lead, advisor_id: null }, { userId: req.user.id });
    return back(req, res, a ? `Auto-assigned to ${a.name}` : 'No eligible advisor (check licences/provinces)', !a);
  }
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(req.body.advisor_id)]);
  if (!a) return back(req, res, 'Advisor not found', true);
  db.run('UPDATE leads SET advisor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [a.id, lead.id]);
  db.insert('lead_events', { lead_id: lead.id, type: 'assigned', user_id: req.user.id, data: { advisor_id: a.id, advisor: a.name, manual: true } });
  back(req, res, `Assigned to ${a.name}`);
});

router.post('/leads/:id/rescore', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const r = scoring.rescore(lead.id, 'manual');
  back(req, res, `Score: ${r.score} (${r.grade})`);
});

router.post('/leads/:id/enroll', auth.requireRole('editor'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const c = db.get('SELECT * FROM campaigns WHERE id = ?', [Number(req.body.campaign_id)]);
  if (!c) return back(req, res, 'Campaign not found', true);
  const step = db.get('SELECT * FROM campaign_steps WHERE campaign_id = ? AND active = 1 ORDER BY position LIMIT 1', [c.id]);
  if (!step) return back(req, res, 'Campaign has no active steps', true);
  db.run(`INSERT INTO enrollments(campaign_id, lead_id, status, current_position, next_run_at) VALUES(?, ?, 'active', 0, ?)
    ON CONFLICT(campaign_id, lead_id) DO UPDATE SET status='active', current_position=0, next_run_at=excluded.next_run_at, stop_reason=NULL, completed_at=NULL`, [c.id, lead.id, sqlNow(step.delay_hours * 3600 * 1000)]);
  db.insert('lead_events', { lead_id: lead.id, type: 'campaign_enrolled', user_id: req.user.id, data: { campaign: c.name, manual: true } });
  back(req, res, `Enrolled in ${c.name}${lead.consent_marketing ? '' : ' (note: no express consent — CASL rules will stop sends unless implied consent applies)'}`);
});

router.post('/leads/:id/stop-drips', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  drip.stopEnrollments(lead.id, `stopped by ${req.user.name}`);
  back(req, res, 'All active drips stopped');
});

router.post('/leads/:id/email', async (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const subject = String(req.body.subject || '').slice(0, 200), body = String(req.body.body || '').slice(0, 10000);
  if (!subject || !body) return back(req, res, 'Subject and message are required', true);
  const r = await mailer.sendEmail({ lead, subject, bodyMd: body, kind: 'transactional' });
  db.insert('lead_events', { lead_id: lead.id, type: 'email_sent', user_id: req.user.id, data: { subject, status: r.status, manual: true } });
  back(req, res, `Email ${r.status}`, r.status === 'failed');
});

router.post('/leads/:id/test', auth.requireRole('editor'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  db.run('UPDATE leads SET is_test = ? WHERE id = ?', [lead.is_test ? 0 : 1, lead.id]);
  scoring.rescore(lead.id, 'test flag');
  back(req, res, lead.is_test ? 'Unmarked as test' : 'Marked as test (excluded from analytics)');
});

router.post('/leads/:id/unsubscribe', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  leadsSvc.unsubscribe(lead, `admin: ${req.user.email}`);
  back(req, res, 'Unsubscribed and suppressed');
});

/** PIPEDA / Law 25 deletion request: removes personal data, keeps an anonymised shell for counts. */
router.post('/leads/:id/delete', auth.requireRole('admin'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  if (req.body.mode === 'anonymise') {
    db.update('leads', lead.id, { first_name: null, last_name: null, email: `deleted-${lead.id}@invalid`, phone: null, postal_code: null, message: null, ip_hash: null, user_agent: null, visitor_id: null, session_id: null, consent_text: null, updated_at: sqlNow() });
    db.run('UPDATE emails SET to_email = ?, html = NULL, text = NULL WHERE lead_id = ?', [`deleted-${lead.id}@invalid`, lead.id]);
    db.insert('lead_events', { lead_id: lead.id, type: 'anonymised', user_id: req.user.id, data: {} });
    res.locals.audit('anonymise', 'lead', lead.id, { ref: lead.ref });
    return back(req, res, 'Personal data removed (anonymised)');
  }
  db.run('DELETE FROM emails WHERE lead_id = ?', [lead.id]);
  db.run('DELETE FROM leads WHERE id = ?', [lead.id]);
  res.locals.audit('delete', 'lead', lead.id, { ref: lead.ref });
  res.redirect(303, '/admin/leads?_ok=' + encodeURIComponent(`Lead ${lead.ref} deleted`));
});

router.post('/leads/bulk', auth.requireRole('editor'), (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean).slice(0, 500);
  const action = String(req.body.action || '');
  let n = 0;
  for (const id of ids) {
    if (action.startsWith('status:')) { leadsSvc.setStatus(id, action.slice(7), { userId: req.user.id }); n++; }
    else if (action === 'auto-assign') { const l = db.get('SELECT * FROM leads WHERE id = ?', [id]); if (l && routing.assign({ ...l, advisor_id: null }, { userId: req.user.id })) n++; }
    else if (action === 'rescore') { scoring.rescore(id, 'bulk'); n++; }
  }
  res.redirect(303, `/admin/leads?_ok=${encodeURIComponent(`${n} lead(s) updated`)}`);
});

module.exports = router;
