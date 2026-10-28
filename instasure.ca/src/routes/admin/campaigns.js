'use strict';
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const drip = require('../../lib/drip');
const mailer = require('../../lib/mailer');
const md = require('../../lib/markdown');
const { CATEGORIES } = require('../../data/products');
const geo = require('../../data/geo');
const leadsSvc = require('../../lib/leads');
const { slugify, arr } = require('../../lib/util');

const router = express.Router();
const TRIGGERS = { lead_created: 'New lead created', quote_abandoned: 'Quote saved but not finished', status_changed: 'Lead status changed', manual: 'Manual enrolment only' };

function stats(id) {
  return db.get(`SELECT
      (SELECT COUNT(*) FROM enrollments WHERE campaign_id = ?) enrolled,
      (SELECT COUNT(*) FROM enrollments WHERE campaign_id = ? AND status = 'active') active,
      (SELECT COUNT(*) FROM enrollments WHERE campaign_id = ? AND status = 'completed') completed,
      (SELECT COUNT(*) FROM enrollments WHERE campaign_id = ? AND status IN ('stopped','unsubscribed')) stopped,
      COUNT(*) sent, SUM(CASE WHEN open_count > 0 THEN 1 ELSE 0 END) opened, SUM(CASE WHEN click_count > 0 THEN 1 ELSE 0 END) clicked
    FROM emails WHERE status IN ('sent','logged') AND enrollment_id IN (SELECT id FROM enrollments WHERE campaign_id = ?)`, [id, id, id, id, id]);
}

router.get('/campaigns', auth.requireRole('editor'), (req, res) => {
  const list = db.all('SELECT c.*, (SELECT COUNT(*) FROM campaign_steps s WHERE s.campaign_id = c.id) steps FROM campaigns c ORDER BY c.active DESC, c.priority DESC, c.name')
    .map((c) => ({ ...c, stats: stats(c.id), filters: db.json(c.filters, {}) }));
  const unsub = db.value('SELECT COUNT(*) FROM suppressions');
  res.admin('campaigns', { title: 'Drip campaigns', list, TRIGGERS, unsub });
});

router.post('/campaigns/run', auth.requireRole('admin'), async (req, res) => {
  const r = await drip.tick({ ignoreQuietHours: req.body.ignore_quiet === '1' });
  res.redirect(303, `/admin/campaigns?_ok=${encodeURIComponent(`Processed ${r.processed || 0}: sent ${r.sent || 0}, deferred ${r.deferred || 0}, stopped ${r.stopped || 0}, completed ${r.completed || 0}`)}`);
});

router.get('/campaigns/new', auth.requireRole('editor'), (req, res) => {
  res.admin('campaign', { title: 'New campaign', c: { name: '', slug: '', trigger: 'lead_created', filters: {}, require_express_consent: 1, active: 0, priority: 0, stop_on_statuses: '["won","lost","junk"]' }, steps: [], TRIGGERS, CATEGORIES, provinces: geo.provinces, LEAD_TYPES: leadsSvc.LEAD_TYPES, STATUSES: leadsSvc.STATUSES, stats: null });
});

router.get('/campaigns/:id', auth.requireRole('editor'), (req, res, next) => {
  const c = db.get('SELECT * FROM campaigns WHERE id = ?', [Number(req.params.id)]);
  if (!c) return next();
  c.filters = db.json(c.filters, {});
  const steps = db.all(`SELECT s.*, (SELECT COUNT(*) FROM emails e WHERE e.step_id = s.id AND e.status IN ('sent','logged')) sent,
      (SELECT COUNT(*) FROM emails e WHERE e.step_id = s.id AND e.open_count > 0) opened, (SELECT COUNT(*) FROM emails e WHERE e.step_id = s.id AND e.click_count > 0) clicked
    FROM campaign_steps s WHERE s.campaign_id = ? ORDER BY s.position`, [c.id]);
  const recent = db.all(`SELECT e.*, l.ref, l.email FROM enrollments e JOIN leads l ON l.id = e.lead_id WHERE e.campaign_id = ? ORDER BY e.id DESC LIMIT 25`, [c.id]);
  res.admin('campaign', { title: c.name, c, steps, recent, stats: stats(c.id), TRIGGERS, CATEGORIES, provinces: geo.provinces, LEAD_TYPES: leadsSvc.LEAD_TYPES, STATUSES: leadsSvc.STATUSES });
});

function campaignRow(b) {
  return {
    name: String(b.name || '').slice(0, 120), description: String(b.description || '').slice(0, 500),
    trigger: TRIGGERS[b.trigger] ? b.trigger : 'manual',
    filters: {
      product_categories: arr(b.product_categories), lead_types: arr(b.lead_types), provinces: arr(b.provinces), statuses: arr(b.statuses),
      min_score: b.min_score ? Number(b.min_score) : undefined,
    },
    stop_on_statuses: arr(b.stop_on_statuses),
    require_express_consent: b.require_express_consent ? 1 : 0, active: b.active ? 1 : 0, priority: Number(b.priority) || 0,
    updated_at: new Date().toISOString(),
  };
}

router.post('/campaigns', auth.requireRole('editor'), (req, res) => {
  const row = campaignRow(req.body);
  if (!row.name) return res.redirect(303, '/admin/campaigns/new?_err=Name+is+required');
  let slug = slugify(row.name); let i = 1;
  while (db.get('SELECT id FROM campaigns WHERE slug = ?', [slug])) slug = `${slugify(row.name)}-${++i}`;
  const id = db.insert('campaigns', { ...row, slug });
  res.locals.audit('create', 'campaign', id, { name: row.name });
  res.redirect(303, `/admin/campaigns/${id}?_ok=Campaign+created+—+add+steps+below`);
});

router.post('/campaigns/:id', auth.requireRole('editor'), (req, res) => {
  const id = Number(req.params.id);
  db.update('campaigns', id, campaignRow(req.body));
  res.locals.audit('update', 'campaign', id);
  res.redirect(303, `/admin/campaigns/${id}?_ok=Saved`);
});

router.post('/campaigns/:id/delete', auth.requireRole('admin'), (req, res) => {
  db.run('DELETE FROM campaigns WHERE id = ?', [Number(req.params.id)]);
  res.locals.audit('delete', 'campaign', req.params.id);
  res.redirect(303, '/admin/campaigns?_ok=Campaign+deleted');
});

router.post('/campaigns/:id/steps', auth.requireRole('editor'), (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const row = {
    delay_hours: Math.max(0, Number(b.delay_value || 0) * (b.delay_unit === 'days' ? 24 : 1)),
    subject: String(b.subject || '').slice(0, 200), preheader: String(b.preheader || '').slice(0, 200), body_md: String(b.body_md || ''),
    cta_label: String(b.cta_label || '').slice(0, 80) || null, cta_url: String(b.cta_url || '').slice(0, 500) || null, active: b.active ? 1 : 0,
  };
  if (!row.subject || !row.body_md) return res.redirect(303, `/admin/campaigns/${id}?_err=Subject+and+body+are+required`);
  if (b.step_id) db.update('campaign_steps', Number(b.step_id), row);
  else db.insert('campaign_steps', { ...row, campaign_id: id, position: (db.value('SELECT MAX(position) FROM campaign_steps WHERE campaign_id = ?', [id]) ?? -1) + 1 });
  res.redirect(303, `/admin/campaigns/${id}?_ok=Step+saved#steps`);
});

router.post('/campaigns/:id/steps/:sid/move', auth.requireRole('editor'), (req, res) => {
  const id = Number(req.params.id);
  const steps = db.all('SELECT id, position FROM campaign_steps WHERE campaign_id = ? ORDER BY position', [id]);
  const i = steps.findIndex((s) => s.id === Number(req.params.sid));
  const j = req.body.dir === 'up' ? i - 1 : i + 1;
  if (i >= 0 && j >= 0 && j < steps.length) {
    [steps[i], steps[j]] = [steps[j], steps[i]];
    db.tx(() => steps.forEach((s, k) => db.run('UPDATE campaign_steps SET position = ? WHERE id = ?', [k, s.id])));
  }
  res.redirect(303, `/admin/campaigns/${id}#steps`);
});

router.post('/campaigns/:id/steps/:sid/delete', auth.requireRole('editor'), (req, res) => {
  db.run('DELETE FROM campaign_steps WHERE id = ? AND campaign_id = ?', [Number(req.params.sid), Number(req.params.id)]);
  const steps = db.all('SELECT id FROM campaign_steps WHERE campaign_id = ? ORDER BY position', [Number(req.params.id)]);
  steps.forEach((s, k) => db.run('UPDATE campaign_steps SET position = ? WHERE id = ?', [k, s.id]));
  res.redirect(303, `/admin/campaigns/${req.params.id}?_ok=Step+deleted#steps`);
});

function sampleLead() {
  return db.get("SELECT * FROM leads WHERE is_test = 0 ORDER BY id DESC LIMIT 1") || {
    id: 0, ref: 'IS-SAMPLE', first_name: 'Alex', last_name: 'Sample', email: 'alex@example.com', product: 'term-life-insurance', province: 'on', city: 'toronto',
    estimate: JSON.stringify({ low: 24.5, high: 34, periodLabel: '/mo' }), advisor_id: (db.get('SELECT id FROM advisors WHERE active = 1 LIMIT 1') || {}).id,
  };
}

router.get('/campaigns/:id/steps/:sid/preview', auth.requireRole('editor'), (req, res, next) => {
  const step = db.get('SELECT * FROM campaign_steps WHERE id = ? AND campaign_id = ?', [Number(req.params.sid), Number(req.params.id)]);
  if (!step) return next();
  const lead = sampleLead();
  const ctx = mailer.mergeContext(lead);
  const html = mailer.layout({ bodyHtml: md.render(mailer.merge(step.body_md, ctx)).html, preheader: mailer.merge(step.preheader, ctx), ctaLabel: mailer.merge(step.cta_label, ctx), ctaUrl: mailer.merge(step.cta_url, ctx), unsubscribe: ctx.unsubscribe_url });
  res.set('Content-Security-Policy', "default-src 'none'; img-src * data:; style-src 'unsafe-inline'").type('html').send(`<!-- Subject: ${mailer.merge(step.subject, ctx).replace(/--/g, '')} -->${html}`);
});

router.post('/campaigns/:id/steps/:sid/test', auth.requireRole('editor'), async (req, res) => {
  const step = db.get('SELECT * FROM campaign_steps WHERE id = ?', [Number(req.params.sid)]);
  if (!step) return res.sendStatus(404);
  const lead = { ...sampleLead(), email: req.user.email };
  const r = await mailer.sendEmail({ lead, to: req.user.email, subject: `[TEST] ${step.subject}`, bodyMd: step.body_md, preheader: step.preheader, ctaLabel: step.cta_label, ctaUrl: step.cta_url, kind: 'transactional', track: false });
  res.redirect(303, `/admin/campaigns/${req.params.id}?_ok=${encodeURIComponent(`Test ${r.status} to ${req.user.email}`)}#steps`);
});

// ───────────── Email log ─────────────
router.get('/emails', auth.requireRole('editor'), (req, res) => {
  const where = []; const params = [];
  if (req.query.status) { where.push('e.status = ?'); params.push(req.query.status); }
  if (req.query.kind) { where.push('e.kind = ?'); params.push(req.query.kind); }
  const rows = db.all(`SELECT e.id, e.kind, e.to_email, e.subject, e.status, e.error, e.open_count, e.click_count, e.sent_at, e.created_at, l.ref, l.id AS lead_id
    FROM emails e LEFT JOIN leads l ON l.id = e.lead_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.id DESC LIMIT 200`, params);
  const totals = db.all('SELECT status, COUNT(*) n FROM emails GROUP BY status');
  res.admin('emails', { title: 'Email log', rows, totals, q: req.query, smtp: !!require('../../config').smtp });
});
router.get('/emails/:id', auth.requireRole('editor'), (req, res, next) => {
  const e = db.get('SELECT html FROM emails WHERE id = ?', [Number(req.params.id)]);
  if (!e) return next();
  res.set('Content-Security-Policy', "default-src 'none'; img-src * data:; style-src 'unsafe-inline'").type('html').send(e.html || '<p>Content removed.</p>');
});

module.exports = router;
