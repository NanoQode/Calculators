'use strict';
/**
 * Follow-up tasks on leads. A task belongs to one user (the person who should act). When it falls
 * due it pops up in that user's admin screens (admin.js polls /admin/tasks/due.json) until it is
 * done or snoozed, and an email reminder goes out once (Settings → task email reminders).
 */
const db = require('../db');
const settings = require('./settings');
const mailer = require('./mailer');
const config = require('../config');
const U = require('./util');

class TaskError extends Error { constructor(m) { super(m); this.status = 422; } }

/**
 * Due time from a form: `due_utc` (ISO, set by the browser from the viewer's own time zone) wins;
 * otherwise `due_local` ('YYYY-MM-DDTHH:MM') is read as Toronto time.
 */
function parseDue(body) {
  if (body.due_utc) { const d = new Date(String(body.due_utc)); if (!isNaN(d)) return U.sqlNow(d.getTime() - Date.now()); }
  return U.localToUtc(body.due_local || body.due_at);
}

function create({ leadId, title, notes, dueAt, assignedUserId, createdBy }) {
  const t = String(title || '').trim().slice(0, 140);
  if (!t) throw new TaskError('Give the task a title.');
  if (!dueAt) throw new TaskError('Choose when the follow-up is due.');
  const id = db.insert('lead_tasks', { lead_id: leadId, title: t, notes: String(notes || '').trim().slice(0, 1000) || null, due_at: dueAt, assigned_user_id: assignedUserId || createdBy || null, created_by: createdBy || null });
  const who = assignedUserId ? (db.get('SELECT name FROM users WHERE id = ?', [assignedUserId]) || {}).name : null;
  db.insert('lead_events', { lead_id: leadId, type: 'task_created', user_id: createdBy, data: { task_id: id, note: `${t} — due ${U.fmtDateTime(dueAt)}${who ? ` · for ${who}` : ''}` } });
  return id;
}

function get(id) { return db.get('SELECT * FROM lead_tasks WHERE id = ?', [Number(id)]); }

function complete(id, userId) {
  const t = get(id); if (!t || t.done_at) return t;
  db.update('lead_tasks', t.id, { done_at: U.sqlNow(), done_by: userId || null });
  db.insert('lead_events', { lead_id: t.lead_id, type: 'task_done', user_id: userId, data: { task_id: t.id, note: t.title } });
  db.run('UPDATE leads SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?', [t.lead_id]);
  return get(id);
}

/** Snooze hides the pop-up for a while; reschedule moves the due time itself (and re-arms the email reminder). */
function snooze(id, minutes, { reschedule = false } = {}) {
  const m = Math.min(30 * 24 * 60, Math.max(5, Number(minutes) || 15));
  if (reschedule) db.update('lead_tasks', Number(id), { due_at: U.sqlNow(m * 60000), snoozed_until: null, reminded_at: null });
  else db.update('lead_tasks', Number(id), { snoozed_until: U.sqlNow(m * 60000) });
  return get(id);
}

const SELECT = `SELECT t.*, l.ref, l.first_name, l.last_name, l.email, l.phone, l.status, l.advisor_id, u.name AS assignee
  FROM lead_tasks t JOIN leads l ON l.id = t.lead_id LEFT JOIN users u ON u.id = t.assigned_user_id`;

/** Tasks that should pop up for this user right now. */
function dueFor(userId) {
  return db.all(`${SELECT} WHERE t.assigned_user_id = ? AND t.done_at IS NULL AND t.due_at <= ? AND (t.snoozed_until IS NULL OR t.snoozed_until <= ?) ORDER BY t.due_at LIMIT 5`, [userId, U.sqlNow(), U.sqlNow()]);
}

/** Open and recently done tasks; `userId` narrows to one person's tasks, `advisorId` to one agent's leads. */
function list({ userId, advisorId, show = 'open' } = {}) {
  const where = []; const params = [];
  if (userId) { where.push('t.assigned_user_id = ?'); params.push(userId); }
  if (advisorId) { where.push('l.advisor_id = ?'); params.push(advisorId); }
  if (show === 'open') where.push('t.done_at IS NULL');
  else if (show === 'done') where.push("t.done_at >= datetime('now','-30 days')");
  return db.all(`${SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${show === 'done' ? 't.done_at DESC' : 't.due_at'} LIMIT 300`, params);
}

function forLead(leadId) { return db.all(`${SELECT} WHERE t.lead_id = ? ORDER BY t.done_at IS NOT NULL, t.due_at`, [leadId]); }

function overdueCount(userId) {
  return db.value('SELECT COUNT(*) FROM lead_tasks WHERE assigned_user_id = ? AND done_at IS NULL AND due_at <= ?', [userId, U.sqlNow()]) || 0;
}

/** One email per task when it falls due (for people who aren't logged in to see the pop-up). */
async function remindDue() {
  if (settings.get('task_email_reminders') === false) return 0;
  const due = db.all(`${SELECT} WHERE t.done_at IS NULL AND t.reminded_at IS NULL AND t.due_at <= ? LIMIT 50`, [U.sqlNow()]);
  let n = 0;
  for (const t of due) {
    db.update('lead_tasks', t.id, { reminded_at: U.sqlNow() });
    const user = t.assigned_user_id ? db.get('SELECT email, name, active FROM users WHERE id = ?', [t.assigned_user_id]) : null;
    if (!user || !user.active || !user.email) continue;
    await mailer.sendEmail({
      to: user.email, kind: 'notification', track: false,
      subject: `Follow-up due: ${t.title} — ${[t.first_name, t.last_name].filter(Boolean).join(' ') || t.email}`,
      bodyMd: [`Hi ${user.name.split(' ')[0]},`, `**${t.title}** was due ${U.fmtDateTime(t.due_at)}.`, t.notes ? `> ${t.notes}` : '', `Lead: **${[t.first_name, t.last_name].filter(Boolean).join(' ') || t.email}** (${t.ref})${t.phone ? ' · ' + U.fmtPhone(t.phone) : ''}`, `[Open the lead](${config.siteUrl}/admin/leads/${t.lead_id})`].filter(Boolean).join('\n\n'),
    });
    n++;
  }
  return n;
}

module.exports = { create, get, complete, snooze, dueFor, list, forLead, overdueCount, remindDue, parseDue, TaskError };
