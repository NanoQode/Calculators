'use strict';
/**
 * Drip campaign engine.
 *  - enroll(lead, trigger): matches active campaigns by trigger + filters, creates enrollments.
 *  - tick(): sends due steps; enforces CASL consent mode, suppressions, stop-statuses and
 *    quiet hours in the lead's provincial time zone; advances or completes enrollments.
 * Runs in-process on an interval (see server.js); safe to run on one instance only (DRIP_DISABLED elsewhere).
 */
const db = require('../db');
const settings = require('./settings');
const mailer = require('./mailer');
const geo = require('../data/geo');
const { sqlNow, toDate } = require('./util');

const SIX_MONTHS_MS = 182 * 24 * 3600 * 1000;
const HOUR = 3600 * 1000;

function matches(campaign, lead) {
  const f = db.json(campaign.filters, {}) || {};
  const inList = (list, v) => !list || !list.length || list.includes(v);
  return (
    inList(f.product_categories, lead.product_category) &&
    inList(f.products, lead.product) &&
    inList(f.lead_types, lead.lead_type) &&
    inList(f.provinces, lead.province) &&
    inList(f.statuses, lead.status) &&
    (!f.min_score || (lead.score || 0) >= Number(f.min_score)) &&
    (!f.max_score || (lead.score || 0) <= Number(f.max_score))
  );
}

function firstStep(campaignId) {
  return db.get('SELECT * FROM campaign_steps WHERE campaign_id = ? AND active = 1 ORDER BY position LIMIT 1', [campaignId]);
}

function enroll(lead, trigger) {
  const campaigns = db.all('SELECT * FROM campaigns WHERE active = 1 AND trigger = ? ORDER BY priority DESC, id', [trigger]);
  const enrolled = [];
  for (const c of campaigns) {
    if (!matches(c, lead)) continue;
    const step = firstStep(c.id);
    if (!step) continue;
    const exists = db.get('SELECT id FROM enrollments WHERE campaign_id = ? AND lead_id = ?', [c.id, lead.id]);
    if (exists) continue;
    const id = db.insert('enrollments', {
      campaign_id: c.id, lead_id: lead.id, status: 'active', current_position: 0,
      next_run_at: sqlNow(step.delay_hours * HOUR),
    });
    db.insert('lead_events', { lead_id: lead.id, type: 'campaign_enrolled', data: { campaign: c.name, enrollment: id } });
    enrolled.push(c.slug);
  }
  return enrolled;
}

function stopEnrollments(leadId, reason, status = 'stopped') {
  db.run(`UPDATE enrollments SET status = ?, stop_reason = ?, completed_at = CURRENT_TIMESTAMP WHERE lead_id = ? AND status = 'active'`, [status, reason, leadId]);
}

/** CASL: express consent always OK; implied consent (inquiry) valid for 6 months if the site allows it. */
function hasConsent(campaign, lead) {
  if (lead.unsubscribed_at) return false;
  if (lead.consent_marketing) return true;
  if (!campaign.require_express_consent) {
    const implied = settings.get('casl_mode') === 'express_or_implied';
    const created = toDate(lead.created_at);
    return implied && created && Date.now() - created.getTime() < SIX_MONTHS_MS && ['quote', 'consult', 'calculator', 'partial'].includes(lead.lead_type);
  }
  return false;
}

/** If outside quiet hours in the lead's province, return the next allowed send time (ms epoch). */
function nextAllowedTime(lead, now = Date.now()) {
  const q = settings.get('quiet_hours') || { start: 8, end: 20 };
  const prov = geo.provinceByCode[lead.province];
  const tz = prov ? prov.tz : 'America/Toronto';
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
  if (hour >= q.start && hour < q.end) return null;
  const hoursUntil = hour >= q.end ? 24 - hour + q.start : q.start - hour;
  return now + hoursUntil * HOUR - (new Date(now).getMinutes() * 60 * 1000);
}

let running = false;
async function tick({ limit = 50, now = Date.now(), ignoreQuietHours = false } = {}) {
  if (running) return { skipped: true };
  running = true;
  const stats = { processed: 0, sent: 0, deferred: 0, stopped: 0, completed: 0 };
  try {
    // Scheduled blog posts publish on the same heartbeat.
    require('./publisher').publishDue();

    const due = db.all(`SELECT e.*, c.stop_on_statuses, c.require_express_consent, c.name AS campaign_name, c.active AS campaign_active
      FROM enrollments e JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.status = 'active' AND e.next_run_at <= ? ORDER BY e.next_run_at LIMIT ?`, [sqlNow(now - Date.now()), limit]);
    for (const en of due) {
      stats.processed++;
      const lead = db.get('SELECT * FROM leads WHERE id = ?', [en.lead_id]);
      if (!lead || !en.campaign_active) { stopEnrollments(en.lead_id, 'campaign inactive or lead deleted'); stats.stopped++; continue; }
      const stopStatuses = db.json(en.stop_on_statuses, []);
      if (stopStatuses.includes(lead.status)) { db.update('enrollments', en.id, { status: 'stopped', stop_reason: `lead status ${lead.status}`, completed_at: sqlNow() }); stats.stopped++; continue; }
      if (lead.lead_type !== 'partial' && /abandon/i.test(en.campaign_name)) { db.update('enrollments', en.id, { status: 'stopped', stop_reason: 'quote completed', completed_at: sqlNow() }); stats.stopped++; continue; }
      if (lead.unsubscribed_at || mailer.isSuppressed(lead.email)) { db.update('enrollments', en.id, { status: 'unsubscribed', stop_reason: 'unsubscribed', completed_at: sqlNow() }); stats.stopped++; continue; }
      if (!hasConsent(en, lead)) { db.update('enrollments', en.id, { status: 'stopped', stop_reason: 'no CASL consent', completed_at: sqlNow() }); stats.stopped++; continue; }
      if (!ignoreQuietHours) {
        const later = nextAllowedTime(lead, now);
        if (later) { db.update('enrollments', en.id, { next_run_at: new Date(later).toISOString().replace('T', ' ').slice(0, 19) }); stats.deferred++; continue; }
      }
      const steps = db.all('SELECT * FROM campaign_steps WHERE campaign_id = ? AND active = 1 ORDER BY position', [en.campaign_id]);
      const step = steps[en.current_position];
      if (!step) { db.update('enrollments', en.id, { status: 'completed', completed_at: sqlNow() }); stats.completed++; continue; }
      const res = await mailer.sendEmail({
        lead, subject: step.subject, bodyMd: step.body_md, preheader: step.preheader, ctaLabel: step.cta_label, ctaUrl: step.cta_url,
        kind: 'drip', enrollmentId: en.id, stepId: step.id,
      });
      db.insert('lead_events', { lead_id: lead.id, type: 'email_sent', data: { campaign: en.campaign_name, step: step.position, subject: step.subject, status: res.status } });
      if (res.status === 'sent' || res.status === 'logged') stats.sent++;
      const next = steps[en.current_position + 1];
      if (next) db.update('enrollments', en.id, { current_position: en.current_position + 1, next_run_at: sqlNow(next.delay_hours * HOUR) });
      else { db.update('enrollments', en.id, { current_position: en.current_position + 1, status: 'completed', completed_at: sqlNow() }); stats.completed++; }
    }
  } finally {
    running = false;
  }
  return stats;
}

let timer = null;
function start(intervalMs) {
  if (timer) return;
  timer = setInterval(() => tick().catch((e) => console.error('[drip] tick failed', e)), intervalMs);
  timer.unref();
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { enroll, tick, start, stop, stopEnrollments, hasConsent, matches, nextAllowedTime };
