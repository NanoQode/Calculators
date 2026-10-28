'use strict';
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const leadsSvc = require('../../lib/leads');
const scoring = require('../../lib/scoring');
const routing = require('../../lib/routing');
const merge = require('../../lib/merge');
const tasks = require('../../lib/tasks');
const stages = require('../../lib/stages');
const drip = require('../../lib/drip');
const mailer = require('../../lib/mailer');
const notegate = require('../../lib/notegate');
const { bySlug, products } = require('../../data/products');
const geo = require('../../data/geo');
const { csvCell, sqlNow, monthStartUtc, fmtPhone } = require('../../lib/util');

const router = express.Router();
const PAGE = 50;

/** Agents only see their own leads; everyone with leads.all sees every lead. */
const isAgent = (req) => !auth.hasPerm(req.user, 'leads.all');
function scope(req) {
  return isAgent(req) ? { sql: ' AND l.advisor_id = ?', params: [req.user.advisor_id || -1] } : { sql: '', params: [] };
}
function canSee(req, lead) { return !!lead && (!isAgent(req) || lead.advisor_id === req.user.advisor_id); }

/** An agent who opened a new lead adds a note to it before opening or working any other lead (lib/notegate). */
router.use('/leads/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  const owed = notegate.pending(req.user);
  if (!owed || owed.id === Number(req.params.id)) return next();
  const msg = `Add a note to ${owed.name} (${owed.ref}) before you open another lead.`;
  if (wantsJson(req)) return res.status(409).json({ ok: false, error: msg, lead_id: owed.id });
  res.redirect(303, `/admin/leads/${owed.id}?_err=${encodeURIComponent(msg)}#add-note`);
});

function filters(req) {
  const q = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (q.status) { where += ' AND l.status = ?'; params.push(q.status); }
  if (q.grade) { where += ' AND l.grade = ?'; params.push(q.grade); }
  if (q.product) { where += ' AND (l.product = ? OR l.products LIKE ?)'; params.push(q.product, `%"${String(q.product).replace(/[%_"]/g, '')}"%`); }
  if (q.province) { where += ' AND l.province = ?'; params.push(q.province); }
  if (q.source) { where += ' AND l.source = ?'; params.push(q.source); }
  if (q.type) { where += ' AND l.lead_type = ?'; params.push(q.type); }
  if (q.advisor === 'none') where += ' AND l.advisor_id IS NULL';
  else if (q.advisor) { where += ' AND l.advisor_id = ?'; params.push(Number(q.advisor)); }
  if (q.verified === '1') where += ' AND l.phone_verified_at IS NOT NULL';
  if (q.repeat === '1') where += ' AND l.inquiry_count > 1';
  if (q.from) { where += ' AND l.created_at >= ?'; params.push(q.from); }
  if (q.to) { where += " AND l.created_at < date(?, '+1 day')"; params.push(q.to); }
  if (!q.tests) where += ' AND l.is_test = 0';
  if (q.q) {
    const like = `%${String(q.q).trim()}%`;
    where += ' AND (l.email LIKE ? OR l.first_name LIKE ? OR l.last_name LIKE ? OR l.phone LIKE ? OR l.ref LIKE ? OR l.id IN (SELECT lead_id FROM lead_refs WHERE ref LIKE ?))';
    params.push(like, like, like, like, like, like);
  }
  const s = scope(req);
  return { where: where + s.sql, params: [...params, ...s.params] };
}

const SORTS = { newest: 'l.created_at DESC', updated: 'COALESCE(l.last_activity_at, l.updated_at) DESC', score: 'l.score DESC, l.created_at DESC', oldest: 'l.created_at ASC', value: 'l.value_estimate DESC' };

/** Agents with this month's lead count and cap, for assignment menus. */
function agentOptions() {
  const m0 = monthStartUtc(0);
  return db.all(`SELECT a.id, a.name, a.provinces, a.categories, a.is_demo, a.active, a.accepting_leads, a.monthly_lead_cap, COALESCE(a.status,'approved') status,
      (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.assigned_at >= ?) month_count
    FROM advisors a WHERE COALESCE(a.status,'approved') = 'approved' ORDER BY a.active DESC, a.name`, [m0]);
}

router.get('/leads', (req, res) => {
  const f = filters(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const total = db.value(`SELECT COUNT(*) FROM leads l${f.where}`, f.params);
  const rows = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id${f.where} ORDER BY ${sort} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, f.params);
  const statusCounts = db.all(`SELECT l.status, COUNT(*) n FROM leads l${f.where.replace(/ AND l\.status = \?/, '')} GROUP BY l.status`, f.params.filter((p, i) => !(req.query.status && i === 0)));
  res.admin('leads', {
    title: 'Leads', rows, total, page, pages: Math.ceil(total / PAGE), q: req.query, statusCounts, stages,
    advisors: agentOptions(), products, provinces: geo.provinces, STATUSES: leadsSvc.STATUSES, bySlug,
    duplicateGroups: auth.hasPerm(req.user, 'leads.manage') ? merge.groups().length : 0,
  });
});

router.get('/leads.csv', auth.requirePerm('leads.manage'), (req, res) => {
  const f = filters(req);
  const rows = db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id${f.where} ORDER BY l.created_at DESC LIMIT 50000`, f.params);
  const cols = ['ref', 'created_at', 'status', 'disposition', 'lead_type', 'grade', 'score', 'first_name', 'last_name', 'email', 'phone', 'phone_verified_at', 'province', 'city', 'postal_code', 'language', 'product', 'products', 'inquiry_count', 'timeframe', 'best_time', 'advisor_name', 'assigned_at', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'landing_page', 'consent_marketing', 'consent_at', 'unsubscribed_at', 'value_estimate', 'won_at'];
  res.locals.audit('export', 'leads', '', { count: rows.length });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="instasure-leads-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'));
});

router.get('/pipeline', (req, res) => {
  const s = scope(req);
  const cols = stages.BOARD;
  const board = {};
  const extra = req.query.advisor && !isAgent(req) ? (req.query.advisor === 'none' ? ' AND l.advisor_id IS NULL' : ` AND l.advisor_id = ${Number(req.query.advisor)}`) : '';
  for (const st of cols) {
    board[st] = db.all(`SELECT l.*, a.name AS advisor_name, (SELECT MIN(t.due_at) FROM lead_tasks t WHERE t.lead_id = l.id AND t.done_at IS NULL) next_task
      FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id WHERE l.status = ? AND l.is_test = 0${s.sql}${extra} ORDER BY l.score DESC, l.created_at DESC LIMIT 60`, [st, ...s.params]);
  }
  const totals = Object.fromEntries(cols.map((c) => [c, db.value(`SELECT COUNT(*) FROM leads l WHERE l.status = ? AND l.is_test = 0${s.sql}${extra}`, [c, ...s.params])]));
  res.admin('pipeline', { title: 'Pipeline', board, cols, totals, bySlug, stages, q: req.query, advisors: isAgent(req) ? [] : agentOptions() });
});

// ───────────── Duplicates ─────────────
router.get('/leads/duplicates', auth.requirePerm('leads.manage'), (req, res) => {
  res.admin('duplicates', { title: 'Duplicate leads', groups: merge.preview(), bySlug, stages, matchPhone: require('../../lib/settings').get('lead_match_phone') !== false });
});
router.post('/leads/duplicates/merge', auth.requirePerm('leads.manage'), (req, res) => {
  if (req.body.all === '1') {
    const r = merge.mergeAll({ userId: req.user.id });
    res.locals.audit('merge', 'leads', 'all', r);
    return res.redirect(303, `/admin/leads/duplicates?_ok=${encodeURIComponent(`Merged ${r.merged} duplicate record${r.merged === 1 ? '' : 's'} into ${r.groups} lead${r.groups === 1 ? '' : 's'}`)}`);
  }
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  const r = merge.mergeGroup(ids, { userId: req.user.id });
  if (!r) return res.redirect(303, '/admin/leads/duplicates?_err=Nothing+to+merge');
  res.locals.audit('merge', 'lead', r.primary.id, { ref: r.primary.ref, merged: r.merged });
  res.redirect(303, `/admin/leads/duplicates?_ok=${encodeURIComponent(`Merged ${r.merged.join(', ')} into ${r.primary.ref}`)}`);
});

// ───────────── Tasks ─────────────
router.get('/tasks', (req, res) => {
  const mine = req.query.who !== 'all' || !auth.hasPerm(req.user, 'leads.manage');
  const show = ['open', 'done'].includes(req.query.show) ? req.query.show : 'open';
  res.admin('tasks', { title: 'Follow-ups', rows: tasks.list({ userId: mine ? req.user.id : null, show }), mine, show, canAll: auth.hasPerm(req.user, 'leads.manage') });
});
router.get('/tasks/due.json', (req, res) => {
  res.json({ ok: true, tasks: tasks.dueFor(req.user.id).map((t) => ({ id: t.id, title: t.title, notes: t.notes, due_at: t.due_at, lead_id: t.lead_id, lead: [t.first_name, t.last_name].filter(Boolean).join(' ') || t.email, ref: t.ref, phone: t.phone ? fmtPhone(t.phone) : null })) });
});
function taskAllowed(req, t) {
  if (!t) return false;
  if (t.assigned_user_id === req.user.id || auth.hasPerm(req.user, 'leads.manage')) return true;
  const lead = db.get('SELECT advisor_id FROM leads WHERE id = ?', [t.lead_id]);
  return canSee(req, lead);
}
const wantsJson = (req) => req.get('accept')?.includes('application/json') || req.is('application/json');
router.post('/tasks/:id/done', (req, res) => {
  const t = tasks.get(req.params.id);
  if (!taskAllowed(req, t)) return res.sendStatus(404);
  tasks.complete(t.id, req.user.id);
  if (wantsJson(req)) return res.json({ ok: true });
  res.redirect(303, String(req.body.back || '').startsWith('/admin/') ? req.body.back : `/admin/leads/${t.lead_id}?_ok=Task+done`);
});
router.post('/tasks/:id/snooze', (req, res) => {
  const t = tasks.get(req.params.id);
  if (!taskAllowed(req, t)) return res.sendStatus(404);
  tasks.snooze(t.id, req.body.minutes, { reschedule: req.body.reschedule === '1' });
  if (wantsJson(req)) return res.json({ ok: true });
  res.redirect(303, String(req.body.back || '').startsWith('/admin/') ? req.body.back : '/admin/tasks?_ok=Snoozed');
});

// ───────────── One lead ─────────────
router.get('/leads/:id', (req, res, next) => {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', [Number(req.params.id)]);
  if (!canSee(req, lead)) return next();
  const noteRequired = notegate.opened(req.user, lead);
  const events = db.all('SELECT e.*, u.name AS user_name FROM lead_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.lead_id = ? ORDER BY e.id DESC LIMIT 300', [lead.id]);
  const emails = db.all('SELECT id, kind, subject, status, sent_at, open_count, click_count, created_at FROM emails WHERE lead_id = ? ORDER BY id DESC', [lead.id]);
  const enrollments = db.all('SELECT e.*, c.name FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id WHERE e.lead_id = ? ORDER BY e.id DESC', [lead.id]);
  const advisor = lead.advisor_id ? db.get('SELECT * FROM advisors WHERE id = ?', [lead.advisor_id]) : null;
  const inquiries = db.all('SELECT * FROM lead_inquiries WHERE lead_id = ? ORDER BY created_at DESC, id DESC', [lead.id]);
  const refs = db.all('SELECT ref, created_at FROM lead_refs WHERE lead_id = ? ORDER BY created_at', [lead.id]);
  const facts = scoring.buildFacts(lead, scoring.engagementFor(lead));
  const pageviews = lead.visitor_id ? db.all('SELECT path, ts FROM pageviews WHERE visitor_id = ? ORDER BY id DESC LIMIT 30', [lead.visitor_id]) : [];
  const agentUser = lead.advisor_id ? db.get('SELECT id, name FROM users WHERE advisor_id = ? AND active = 1 ORDER BY id LIMIT 1', [lead.advisor_id]) : null;
  res.admin('lead', {
    title: `Lead ${lead.ref}`, lead, events, emails, enrollments, advisor, inquiries, refs, facts, pageviews, stages, agentUser,
    leadTasks: tasks.forLead(lead.id), allProducts: leadsSvc.productsOf(lead),
    product: bySlug[lead.product], prov: geo.provinceByCode[lead.province], bySlug,
    inputs: db.json(lead.quote_inputs, {}), estimate: db.json(lead.estimate, {}), breakdown: db.json(lead.score_breakdown, []),
    advisors: agentOptions(),
    campaigns: db.all('SELECT id, name FROM campaigns WHERE active = 1 ORDER BY name'),
    candidates: routing.candidates(lead).map((a) => a.id),
    STATUSES: leadsSvc.STATUSES, noteRequired,
  });
});

function back(req, res, msg, err) {
  const ret = String(req.body.return || '');
  const base = ret === 'pipeline' ? '/admin/pipeline' : `/admin/leads/${req.params.id}`;
  res.redirect(303, `${base}?${err ? '_err' : '_ok'}=${encodeURIComponent(msg)}`);
}
function load(req) { const l = db.get('SELECT * FROM leads WHERE id = ?', [Number(req.params.id)]); return canSee(req, l) ? l : null; }

/**
 * The stage pop-up: stage, contact outcome (disposition), notes, score adjustment and an optional
 * follow-up task in one submit. Each part is recorded on the timeline with its timestamp.
 */
function update(req, res) {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const b = req.body;
  const stage = String(b.status || b.stage || lead.status);
  const disposition = stages.dispositionByKey[b.disposition] ? b.disposition : null;
  const note = String(b.note || '').trim().slice(0, 4000) || null;
  const done = [];
  try {
    if (!leadsSvc.STATUSES.includes(stage)) throw new leadsSvc.LeadError('Choose a valid stage.');
    if (stage !== lead.status) { leadsSvc.setStatus(lead.id, stage, { userId: req.user.id, reason: b.reason || null, disposition, note }); done.push(`stage → ${stages.label(stage)}`); }
    else if (disposition || note) { leadsSvc.logActivity(lead.id, { userId: req.user.id, disposition, note }); done.push(disposition ? 'outcome logged' : 'note added'); }
    if (b.score_adjustment !== undefined && b.score_adjustment !== '') {
      const adj = Math.max(-50, Math.min(50, Math.round(Number(b.score_adjustment) || 0)));
      if (adj !== (Number(lead.score_adjustment) || 0)) {
        db.update('leads', lead.id, { score_adjustment: adj });
        db.insert('lead_events', { lead_id: lead.id, type: 'score_adjusted', user_id: req.user.id, data: { from: lead.score_adjustment || 0, to: adj, note: `Manual score adjustment ${adj > 0 ? '+' : ''}${adj}` } });
        done.push('score updated');
      }
    }
    scoring.rescore(lead.id, done.length ? done.join(', ') : 'updated');
    if (b.task_title && (b.due_utc || b.due_local)) {
      const assignee = b.task_for === 'agent' ? (db.get('SELECT id FROM users WHERE advisor_id = ? AND active = 1 ORDER BY id LIMIT 1', [lead.advisor_id]) || {}).id : req.user.id;
      tasks.create({ leadId: lead.id, title: b.task_title, notes: b.task_notes, dueAt: tasks.parseDue(b), assignedUserId: assignee || req.user.id, createdBy: req.user.id });
      done.push('follow-up scheduled');
    }
  } catch (e) {
    if (e instanceof leadsSvc.LeadError || e instanceof tasks.TaskError) return back(req, res, e.message, true);
    throw e;
  }
  if (note) notegate.noted(req.user, lead.id);
  back(req, res, done.length ? `Saved: ${done.join(', ')}` : 'Nothing changed');
}
router.post('/leads/:id/update', update);
router.post('/leads/:id/status', update); // older forms post here
router.post('/leads/:id/note', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const note = String(req.body.note || '').trim().slice(0, 4000);
  if (note) { leadsSvc.logActivity(lead.id, { userId: req.user.id, note }); notegate.noted(req.user, lead.id); }
  back(req, res, note ? 'Note added' : 'Write a note first', !note);
});
router.post('/leads/:id/call', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const note = String(req.body.note || '').trim().slice(0, 1000);
  db.insert('lead_events', { lead_id: lead.id, type: 'call', user_id: req.user.id, data: { outcome: String(req.body.outcome || '').slice(0, 60), note } });
  if (lead.status === 'new') leadsSvc.setStatus(lead.id, 'contacted', { userId: req.user.id });
  if (note) notegate.noted(req.user, lead.id);
  back(req, res, 'Call logged');
});

router.post('/leads/:id/tasks', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  try {
    const assignee = req.body.task_for === 'agent' ? (db.get('SELECT id FROM users WHERE advisor_id = ? AND active = 1 ORDER BY id LIMIT 1', [lead.advisor_id]) || {}).id : req.user.id;
    tasks.create({ leadId: lead.id, title: req.body.task_title, notes: req.body.task_notes, dueAt: tasks.parseDue(req.body), assignedUserId: assignee || req.user.id, createdBy: req.user.id });
  } catch (e) { if (e instanceof tasks.TaskError) return back(req, res, e.message, true); throw e; }
  back(req, res, 'Follow-up scheduled');
});

router.post('/leads/:id/assign', auth.requirePerm('leads.manage'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const v = String(req.body.advisor_id || '');
  if (v === 'auto') {
    const a = routing.assign({ ...lead }, { userId: req.user.id, mode: require('../../lib/settings').get('assignment_mode') === 'manual' ? 'best_match' : undefined });
    if (a) leadsSvc.notifyAssignee(lead.id, { by: req.user.name }).catch(() => {});
    return back(req, res, a ? `Auto-assigned to ${a.name}` : 'No eligible agent (licensed for the province and product, accepting leads, under their monthly cap)', !a);
  }
  if (v === 'none') { routing.unassign(lead, { userId: req.user.id }); return back(req, res, 'Unassigned'); }
  const r = routing.assignTo(lead, v, { userId: req.user.id });
  if (r.error) return back(req, res, r.error, true);
  leadsSvc.notifyAssignee(lead.id, { by: req.user.name }).catch(() => {});
  back(req, res, `Assigned to ${r.advisor.name}${r.warnings.length ? ` (note: ${r.warnings.join('; ')})` : ''}`);
});

router.post('/leads/:id/rescore', (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  const r = scoring.rescore(lead.id, 'manual');
  back(req, res, `Score: ${r.score} (${r.grade})`);
});

router.post('/leads/:id/enroll', auth.requirePerm('leads.manage'), (req, res) => {
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

router.post('/leads/:id/test', auth.requirePerm('leads.manage'), (req, res) => {
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

/** Delete: "anonymise" keeps a shell for counts (PIPEDA / Law 25 request); otherwise the lead and everything attached is removed. */
router.post('/leads/:id/delete', auth.requireRole('admin'), (req, res) => {
  const lead = load(req); if (!lead) return res.sendStatus(404);
  if (req.body.mode === 'anonymise') {
    db.update('leads', lead.id, { first_name: null, last_name: null, email: `deleted-${lead.id}@invalid`, phone: null, postal_code: null, message: null, ip_hash: null, user_agent: null, visitor_id: null, session_id: null, consent_text: null, updated_at: sqlNow() });
    db.run("UPDATE lead_inquiries SET message = NULL, quote_inputs = '{}' WHERE lead_id = ?", [lead.id]);
    db.run('UPDATE emails SET to_email = ?, html = NULL, text = NULL WHERE lead_id = ?', [`deleted-${lead.id}@invalid`, lead.id]);
    db.insert('lead_events', { lead_id: lead.id, type: 'anonymised', user_id: req.user.id, data: {} });
    res.locals.audit('anonymise', 'lead', lead.id, { ref: lead.ref });
    return back(req, res, 'Personal data removed (anonymised)');
  }
  leadsSvc.remove([lead.id]);
  res.locals.audit('delete', 'lead', lead.id, { ref: lead.ref });
  res.redirect(303, '/admin/leads?_ok=' + encodeURIComponent(`Lead ${lead.ref} deleted`));
});

router.post('/leads/bulk', auth.requirePerm('leads.manage'), (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean).slice(0, 500);
  const action = String(req.body.action || '');
  if (!ids.length) return res.redirect(303, '/admin/leads?_err=Select+at+least+one+lead');
  if (action === 'delete') {
    if (!auth.can(req.user, 'admin')) return res.redirect(303, '/admin/leads?_err=Only+admins+can+delete+leads');
    const gone = leadsSvc.remove(ids);
    res.locals.audit('delete', 'leads', 'bulk', { refs: gone.map((g) => g.ref) });
    return res.redirect(303, `/admin/leads?_ok=${encodeURIComponent(`${gone.length} lead${gone.length === 1 ? '' : 's'} deleted`)}`);
  }
  let n = 0; const notes = new Set();
  for (const id of ids) {
    const l = db.get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!l) continue;
    if (action.startsWith('status:')) { leadsSvc.setStatus(id, action.slice(7), { userId: req.user.id }); n++; }
    else if (action === 'auto-assign') { if (routing.assign({ ...l }, { userId: req.user.id, mode: require('../../lib/settings').get('assignment_mode') === 'manual' ? 'best_match' : undefined })) { leadsSvc.notifyAssignee(id, { by: req.user.name }).catch(() => {}); n++; } }
    else if (action.startsWith('assign:')) { const r = routing.assignTo(l, action.slice(7), { userId: req.user.id }); if (!r.error) { n++; r.warnings.forEach((w) => notes.add(w)); leadsSvc.notifyAssignee(id, { by: req.user.name }).catch(() => {}); } }
    else if (action === 'unassign') { routing.unassign(l, { userId: req.user.id }); n++; }
    else if (action === 'rescore') { scoring.rescore(id, 'bulk'); n++; }
  }
  if (action.startsWith('assign:') || action === 'auto-assign' || action === 'unassign') res.locals.audit('assign', 'leads', 'bulk', { action, count: n });
  res.redirect(303, `/admin/leads?_ok=${encodeURIComponent(`${n} lead(s) updated${notes.size ? ` (note: ${[...notes].join('; ')})` : ''}`)}`);
});

module.exports = router;
module.exports.agentOptions = agentOptions;
