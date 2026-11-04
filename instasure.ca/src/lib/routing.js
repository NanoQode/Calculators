'use strict';
/**
 * Lead distribution. An agent is eligible for a lead when they are approved, active, accepting
 * leads, licensed in the lead's province for its product category, under their open-lead limit
 * and under their monthly lead cap, has a lead credit if they pay per lead (lib/billing.js) and the lead
 * passes their own filters (province, line, product, grade). Then, in order:
 *   1. Direct rules (Admin → Lead distribution): province / category / desk → a named agent.
 *   2. Specialist desk: leads for a desk go to an eligible agent who staffs it, if there is one.
 *   3. The distribution mode:
 *        round_robin — strict rotation: the eligible agent assigned longest ago gets the lead;
 *        best_match  — language match first, then a weighted least-recently-assigned score;
 *        manual      — nothing is assigned automatically; leads wait for an admin.
 * Admins and agent managers can always assign or reassign by hand (caps are shown, not enforced).
 */
const db = require('../db');
const settings = require('./settings');
const { deskBySlug } = require('./specialties');
const { OPEN_SQL } = require('./stages');
const { monthStartUtc } = require('./util');
const billing = require('./billing');

const MODES = { round_robin: 'Round-robin (even rotation)', best_match: 'Best match (language, weight, least recently assigned)', manual: 'Manual only (admins assign every lead)' };

const staffs = (a, desk) => db.json(a.specialties, []).includes(desk);

/** Leads assigned to an agent since the start of this calendar month (Toronto). */
function monthCount(advisorId, now = new Date()) {
  return db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND assigned_at >= ?', [advisorId, monthStartUtc(0, now)]) || 0;
}
function atCap(a, now) { return a.monthly_lead_cap !== null && a.monthly_lead_cap !== undefined && a.monthly_lead_cap !== '' && monthCount(a.id, now) >= Number(a.monthly_lead_cap); }

function pool() {
  return db.all(`SELECT a.*, (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status IN ${OPEN_SQL}) AS open_leads
    FROM advisors a WHERE a.active = 1 AND a.accepting_leads = 1 AND COALESCE(a.status, 'approved') = 'approved'`);
}

function licensedFor(a, lead) {
  return db.json(a.provinces, []).includes(lead.province) && (!lead.product_category || db.json(a.categories, []).includes(lead.product_category));
}

/** Agents who may receive this lead automatically right now. */
function candidates(lead, now = new Date()) {
  return pool().filter((a) => licensedFor(a, lead) && (!a.max_open_leads || a.open_leads < a.max_open_leads) && !atCap(a, now)
    && billing.prefsAllow(a, lead) && billing.hasCredit(a));
}

const lastTs = (a) => (a.last_assigned_at ? new Date(a.last_assigned_at.replace(' ', 'T') + 'Z').getTime() : 0);

/** Best match: prefer the lead's language, then weighted idle time, lightly penalising open load. */
function pick(lead, list) {
  if (!list.length) return null;
  const lang = lead.language || 'en';
  const langMatch = list.filter((a) => db.json(a.languages, ['en']).includes(lang));
  const choices = langMatch.length ? langMatch : list;
  const now = Date.now();
  let best = null; let bestScore = -Infinity;
  for (const a of choices) {
    const idle = (now - lastTs(a)) / 60000 + 1; // minutes since last assignment
    const score = idle * Math.max(1, a.weight || 1) - a.open_leads * 0.01;
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best;
}

/** Round-robin: whoever was assigned longest ago (never assigned first), ties by id. */
function rotate(list) {
  if (!list.length) return null;
  return [...list].sort((a, b) => lastTs(a) - lastTs(b) || a.id - b.id)[0];
}

function ruleMatches(rule, lead) {
  return (!rule.province || rule.province === lead.province)
    && (!rule.category || rule.category === lead.product_category)
    && (!rule.service || rule.service === lead.service);
}

/**
 * Record an assignment: lead, agent rotation time, timeline event. On a reassignment, the lead's open
 * follow-ups that belonged to the previous agent move to the new agent's login (when they have one).
 */
function setAgent(lead, advisor, { userId, data = {}, rotation = true } = {}) {
  db.tx(() => {
    db.run('UPDATE leads SET advisor_id = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [advisor.id, lead.id]);
    // Pay-per-lead agents: the new agent uses a credit, a previous agent gets theirs back.
    const credit = billing.onAssign(lead, advisor, { userId });
    if (credit) data = { ...data, credit: credit.pool };
    // Millisecond precision, so the rotation still advances when several leads arrive in the same second.
    if (rotation) db.run("UPDATE advisors SET last_assigned_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?", [advisor.id]);
    const reassigned = !!lead.advisor_id && lead.advisor_id !== advisor.id;
    let moved = 0;
    if (reassigned) {
      const to = db.get('SELECT id FROM users WHERE advisor_id = ? AND active = 1 ORDER BY id LIMIT 1', [advisor.id]);
      if (to) {
        moved = Number(db.run(`UPDATE lead_tasks SET assigned_user_id = ? WHERE lead_id = ? AND done_at IS NULL
          AND assigned_user_id IN (SELECT id FROM users WHERE advisor_id = ?)`, [to.id, lead.id, lead.advisor_id]).changes) || 0;
      }
    }
    db.insert('lead_events', { lead_id: lead.id, type: reassigned ? 'reassigned' : 'assigned', user_id: userId, data: { advisor_id: advisor.id, advisor: advisor.name, from_advisor_id: lead.advisor_id || undefined, tasks_moved: moved || undefined, ...data } });
  });
  return advisor;
}

/** Automatic assignment. Returns the agent, or null (and logs why) when nobody is eligible. */
function assign(lead, { userId, mode } = {}) {
  const s = settings.all();
  mode = mode || s.assignment_mode || 'best_match';
  if (mode === 'manual') return null;
  const all = candidates(lead);
  const desk = lead.service && deskBySlug[lead.service] ? lead.service : null;

  for (const rule of s.assignment_rules || []) {
    if (!ruleMatches(rule, lead)) continue;
    const a = all.find((x) => x.id === Number(rule.advisor_id));
    if (a) return setAgent(lead, a, { userId, data: { rule: true, mode } });
  }

  const specialists = desk ? all.filter((a) => staffs(a, desk)) : [];
  const list = specialists.length ? specialists : all;
  const advisor = mode === 'round_robin' ? rotate(list) : pick(lead, list);
  if (!advisor) {
    db.insert('lead_events', { lead_id: lead.id, type: 'assignment_failed', data: { reason: 'No eligible agent: licensed for this province and product, accepting leads and under their monthly cap', desk } });
    return null;
  }
  const data = { mode };
  if (desk) {
    data.desk = deskBySlug[desk].desk;
    data.specialist = specialists.length > 0;
    if (!specialists.length) data.note = 'No specialist on this desk is licensed for the province; routed to a licensed generalist.';
  }
  return setAgent(lead, advisor, { userId, data });
}

/** Manual assignment by an admin or agent manager: always allowed, with warnings recorded. */
function assignTo(lead, advisorId, { userId } = {}) {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [Number(advisorId)]);
  if (!a) return { error: 'Agent not found' };
  const warnings = [];
  if (!licensedFor(a, lead)) warnings.push(`not licensed in ${String(lead.province || '?').toUpperCase()} for this product`);
  if (atCap(a)) warnings.push('already at their monthly lead cap');
  if ((a.status || 'approved') !== 'approved' || !a.active) warnings.push('not an active approved agent');
  if (billing.isMetered(a) && billing.balance(a.id) <= 0) warnings.push('has no lead credits left (delivered free of charge)');
  setAgent(lead, a, { userId, rotation: false, data: { manual: true, warnings: warnings.length ? warnings : undefined } });
  return { advisor: a, warnings };
}

/**
 * Manual bulk assignment. One agent: every lead goes to them. Several agents: leads are shared evenly,
 * each lead going to the agent with the fewest from this batch among those licensed for it (any of
 * them when none is). Leads already with their target are left alone.
 * Returns { moved: { advisorId: [leadIds] }, unchanged, warnings }.
 */
function assignMany(leads, advisorIds, { userId } = {}) {
  const targets = [...new Set(advisorIds.map(Number).filter(Boolean))]
    .map((id) => db.get('SELECT * FROM advisors WHERE id = ?', [id])).filter(Boolean);
  const out = { moved: {}, unchanged: 0, warnings: new Set() };
  if (!targets.length) return { ...out, error: 'Choose at least one agent' };
  const given = new Map(targets.map((a) => [a.id, 0]));
  const month = new Map(targets.map((a) => [a.id, monthCount(a.id)]));
  for (const lead of leads) {
    let to = targets[0];
    if (targets.length > 1) {
      const licensed = targets.filter((a) => licensedFor(a, lead));
      const pool = licensed.length ? licensed : targets;
      to = [...pool].sort((a, b) => given.get(a.id) - given.get(b.id) || month.get(a.id) - month.get(b.id) || a.id - b.id)[0];
    }
    given.set(to.id, given.get(to.id) + 1); // a lead the agent already holds still counts toward their share
    if (lead.advisor_id === to.id) { out.unchanged++; continue; }
    const r = assignTo(lead, to.id, { userId });
    r.warnings.forEach((w) => out.warnings.add(`${to.name}: ${w}`));
    month.set(to.id, month.get(to.id) + 1);
    (out.moved[to.id] = out.moved[to.id] || []).push(lead.id);
  }
  return { ...out, warnings: [...out.warnings] };
}

function unassign(lead, { userId } = {}) {
  billing.onUnassign(lead, { userId });
  db.run('UPDATE leads SET advisor_id = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [lead.id]);
  db.insert('lead_events', { lead_id: lead.id, type: 'unassigned', user_id: userId, data: { from_advisor_id: lead.advisor_id } });
}

const PUBLIC = "active = 1 AND COALESCE(show_on_site, 1) = 1 AND COALESCE(status, 'approved') = 'approved'";

/** Advisors able to serve a province/category — used on public pages ("advisors near you"). Desk specialists first. */
function forArea(province, category, limit = 3, desk = null) {
  const list = db.all(`SELECT * FROM advisors WHERE ${PUBLIC} ORDER BY is_demo, years_experience DESC`)
    .filter((a) => (!province || db.json(a.provinces, []).includes(province)) && (!category || db.json(a.categories, []).includes(category)));
  if (desk) list.sort((a, b) => staffs(b, desk) - staffs(a, desk));
  return list.slice(0, limit);
}

/** Active public advisors who staff a desk, in any province (desk pages and the admin coverage view). */
function specialistsFor(desk) {
  return db.all(`SELECT * FROM advisors WHERE ${PUBLIC} ORDER BY is_demo, years_experience DESC`).filter((a) => staffs(a, desk));
}

module.exports = { MODES, PUBLIC, assign, assignTo, assignMany, unassign, candidates, pick, rotate, forArea, specialistsFor, monthCount, atCap, licensedFor };
