'use strict';
/**
 * Advisor routing: assign each lead to a licensed advisor for the lead's province and product
 * category, preferring the lead's language, respecting capacity, and spreading load with a
 * weighted least-recently-assigned rotation.
 */
const db = require('../db');

const OPEN = "('new','contacted','quoted','application')";

function candidates(lead) {
  const rows = db.all(`SELECT a.*, (SELECT COUNT(*) FROM leads l WHERE l.advisor_id = a.id AND l.status IN ${OPEN}) AS open_leads
    FROM advisors a WHERE a.active = 1 AND a.accepting_leads = 1`);
  return rows.filter((a) => {
    const provinces = db.json(a.provinces, []);
    const cats = db.json(a.categories, []);
    return provinces.includes(lead.province) && (!lead.product_category || cats.includes(lead.product_category)) && (!a.max_open_leads || a.open_leads < a.max_open_leads);
  });
}

function pick(lead, list) {
  if (!list.length) return null;
  const lang = lead.language || 'en';
  const langMatch = list.filter((a) => db.json(a.languages, ['en']).includes(lang));
  const pool = langMatch.length ? langMatch : list;
  const now = Date.now();
  let best = null; let bestScore = -Infinity;
  for (const a of pool) {
    const last = a.last_assigned_at ? new Date(a.last_assigned_at.replace(' ', 'T') + 'Z').getTime() : 0;
    const idle = (now - last) / 60000 + 1; // minutes since last assignment
    const score = idle * Math.max(1, a.weight || 1) - a.open_leads * 0.01;
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best;
}

function assign(lead, { userId } = {}) {
  const advisor = pick(lead, candidates(lead));
  if (!advisor) {
    db.insert('lead_events', { lead_id: lead.id, type: 'assignment_failed', data: { reason: 'No licensed advisor available for this province/product' } });
    return null;
  }
  db.tx(() => {
    db.run('UPDATE leads SET advisor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [advisor.id, lead.id]);
    db.run('UPDATE advisors SET last_assigned_at = CURRENT_TIMESTAMP WHERE id = ?', [advisor.id]);
    db.insert('lead_events', { lead_id: lead.id, type: 'assigned', user_id: userId, data: { advisor_id: advisor.id, advisor: advisor.name } });
  });
  return advisor;
}

/** Advisors able to serve a province/category — used on public pages ("advisors near you"). */
function forArea(province, category, limit = 3) {
  return db.all('SELECT * FROM advisors WHERE active = 1 ORDER BY is_demo, years_experience DESC')
    .filter((a) => (!province || db.json(a.provinces, []).includes(province)) && (!category || db.json(a.categories, []).includes(category)))
    .slice(0, limit);
}

module.exports = { assign, candidates, pick, forArea };
