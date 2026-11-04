'use strict';
/**
 * Note before the next lead. When an agent opens a lead that is still in the "New lead" stage, they
 * must add a note to it (a note, a logged call with a note, or a stage update with a note) before they
 * can open or work any other lead. Only agents (role "advisor") are held to it; admins, editors and
 * agent managers are not. Switch: Admin → Lead distribution ("require_note_on_new").
 */
const db = require('../db');
const settings = require('./settings');

function applies(user) { return !!(user && user.role === 'advisor' && settings.get('require_note_on_new')); }

function clear(userId) { db.run('UPDATE users SET note_due_lead_id = NULL, note_due_since = NULL WHERE id = ?', [userId]); }

/** The lead this agent still owes a note on, or null. Clears itself if the lead was deleted or reassigned. */
function pending(user) {
  if (!applies(user)) return null;
  const row = db.get('SELECT note_due_lead_id AS id, note_due_since AS since FROM users WHERE id = ?', [user.id]);
  if (!row || !row.id) return null;
  const lead = db.get('SELECT id, ref, first_name, last_name, email, advisor_id FROM leads WHERE id = ?', [row.id]);
  if (!lead || lead.advisor_id !== user.advisor_id) { clear(user.id); return null; }
  return { ...lead, since: row.since, name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email };
}

const hasNoteBy = (leadId, userId) => !!db.get(`SELECT 1 FROM lead_events WHERE lead_id = ? AND user_id = ?
  AND TRIM(COALESCE(json_extract(data, '$.note'), '')) != '' LIMIT 1`, [leadId, userId]);

/** Call when an agent opens a lead. Returns true when a note is now required on it. */
function opened(user, lead) {
  if (!applies(user) || !lead) return false;
  const owed = pending(user);
  if (owed) return owed.id === lead.id;
  if (lead.status !== 'new' || hasNoteBy(lead.id, user.id)) return false;
  db.run("UPDATE users SET note_due_lead_id = ?, note_due_since = strftime('%Y-%m-%d %H:%M:%S', 'now') WHERE id = ?", [lead.id, user.id]);
  db.insert('lead_events', { lead_id: lead.id, type: 'opened', user_id: user.id, data: {} });
  return true;
}

/** Call after a note is saved on a lead: releases the agent if it was the lead they owed a note on. */
function noted(user, leadId) {
  if (user) db.run('UPDATE users SET note_due_lead_id = NULL, note_due_since = NULL WHERE id = ? AND note_due_lead_id = ?', [user.id, leadId]);
}

module.exports = { applies, pending, opened, noted, clear };
