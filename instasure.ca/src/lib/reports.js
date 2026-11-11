'use strict';
/**
 * Daily lead report for agent managers (and any user with "daily report" ticked).
 * Sent once a day after the configured hour (Toronto time) from the scheduler heartbeat, or on
 * demand from Admin → Daily report. Counts are by Toronto calendar day, exclude test leads, and
 * count people (leads) and requests (inquiries, which include repeat requests) separately.
 */
const db = require('../db');
const settings = require('./settings');
const mailer = require('./mailer');
const config = require('../config');
const stages = require('./stages');
const routing = require('./routing');
const { bySlug } = require('../data/products');
const geo = require('../data/geo');
const specialties = require('./specialties');
const U = require('./util');

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const delta = (now, before) => (before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : now ? 'new' : '—');

function range(from, to) {
  const n = (sql, params = []) => db.value(sql, [from, to, ...params]) || 0;
  const leads = n("SELECT COUNT(*) FROM leads WHERE is_test = 0 AND lead_type != 'partial' AND created_at >= ? AND created_at < ?");
  const inquiries = n("SELECT COUNT(*) FROM lead_inquiries i JOIN leads l ON l.id = i.lead_id WHERE l.is_test = 0 AND i.lead_type != 'partial' AND i.created_at >= ? AND i.created_at < ?");
  const repeats = n("SELECT COUNT(*) FROM lead_inquiries i JOIN leads l ON l.id = i.lead_id WHERE l.is_test = 0 AND i.origin = 'repeat' AND i.created_at >= ? AND i.created_at < ?");
  const won = n("SELECT COUNT(*) FROM leads WHERE is_test = 0 AND won_at >= ? AND won_at < ?");
  return { leads, inquiries, repeats, won };
}

function top(sql, from, to, label, limit = 5) {
  return db.all(sql, [from, to]).slice(0, limit).map((r) => ({ label: label(r.k), n: r.n }));
}

/** Build the report for the Toronto day before `now` (and week / month to date around it). */
function build(now = new Date()) {
  const today = U.dayStartUtc(0, now), yStart = U.dayStartUtc(-1, now), yPrev = U.dayStartUtc(-2, now);
  const w0 = U.dayStartUtc(-7, now), w1 = U.dayStartUtc(-14, now);
  const m0 = U.monthStartUtc(0, now);
  // Month to date (on the 1st: all of last month), compared with the same number of days the month before.
  const first = today === m0;
  const monthFrom = first ? U.monthStartUtc(-1, now) : m0;
  const monthTo = today;
  const prevFrom = first ? U.monthStartUtc(-2, now) : U.monthStartUtc(-1, now);
  const prevTo = U.sqlNow(U.toDate(prevFrom).getTime() + (U.toDate(monthTo) - U.toDate(monthFrom)) - Date.now());

  const day = range(yStart, today), dayBefore = range(yPrev, yStart);
  const week = range(w0, today), weekBefore = range(w1, w0);
  const month = range(monthFrom, monthTo), monthBefore = range(prevFrom, prevTo);
  const L = "FROM lead_inquiries i JOIN leads l ON l.id = i.lead_id WHERE l.is_test = 0 AND i.lead_type != 'partial' AND i.created_at >= ? AND i.created_at < ?";
  const provinceName = (k) => (geo.provinceByCode[k] || {}).name || (k ? String(k).toUpperCase() : 'Unknown');

  const r = {
    date: U.localDate(new Date(U.toDate(yStart).getTime() + 3600000)),
    monthLabel: U.monthYear(new Date(U.toDate(monthFrom).getTime() + 86400000 * 2)),
    day, dayBefore, week, weekBefore, month, monthBefore,
    topProvinces: top(`SELECT l.province k, COUNT(*) n ${L} GROUP BY l.province ORDER BY n DESC`, w0, today, provinceName),
    topCities: top(`SELECT l.city || '/' || l.province k, COUNT(*) n ${L} AND l.city IS NOT NULL GROUP BY l.city, l.province ORDER BY n DESC`, w0, today, (k) => { const [c, p] = String(k).split('/'); return `${(geo.cityByKey[`${p}/${c}`] || {}).name || c}, ${String(p).toUpperCase()}`; }),
    topProducts: top(`SELECT i.product k, COUNT(*) n ${L} AND i.product IS NOT NULL GROUP BY i.product ORDER BY n DESC`, w0, today, (k) => (bySlug[k] || {}).name || k, 8),
    topServices: top(`SELECT i.service k, COUNT(*) n ${L} AND i.service IS NOT NULL GROUP BY i.service ORDER BY n DESC`, w0, today, (k) => specialties.labelFor(k)),
    types: top(`SELECT i.lead_type k, COUNT(*) n ${L} GROUP BY i.lead_type ORDER BY n DESC`, w0, today, (k) => ({ quote: 'Instant quote', consult: 'Advisor call request', calculator: 'Calculator result', guide: 'Guide download', newsletter: 'Newsletter' }[k] || k), 6),
    sources: top(`SELECT COALESCE(i.source, 'direct') k, COUNT(*) n ${L} GROUP BY k ORDER BY n DESC`, w0, today, (k) => k, 6),
    grades: db.all("SELECT COALESCE(grade, '—') g, COUNT(*) n FROM leads WHERE is_test = 0 AND lead_type != 'partial' AND created_at >= ? AND created_at < ? GROUP BY grade ORDER BY grade", [w0, today]),
    funnel: stages.STAGES.filter((s) => s.board).map((s) => ({ label: s.label, n: db.value('SELECT COUNT(*) FROM leads WHERE is_test = 0 AND status = ? AND created_at >= ? AND created_at < ?', [s.key, monthFrom, monthTo]) || 0 })),
    unassigned: db.value(`SELECT COUNT(*) FROM leads WHERE is_test = 0 AND advisor_id IS NULL AND status IN ${stages.OPEN_SQL} AND lead_type NOT IN ('partial','newsletter')`) || 0,
    stale: db.value("SELECT COUNT(*) FROM leads WHERE is_test = 0 AND status = 'new' AND advisor_id IS NOT NULL AND assigned_at < datetime('now','-1 day')") || 0,
    overdueTasks: db.value('SELECT COUNT(*) FROM lead_tasks WHERE done_at IS NULL AND due_at < ?', [U.sqlNow()]) || 0,
    otp: { started: db.value('SELECT COUNT(*) FROM otp_requests WHERE created_at >= ? AND created_at < ?', [w0, today]) || 0, verified: db.value('SELECT COUNT(*) FROM otp_requests WHERE verified_at IS NOT NULL AND created_at >= ? AND created_at < ?', [w0, today]) || 0 },
    pendingAgents: db.value("SELECT COUNT(*) FROM advisors WHERE status = 'pending'") || 0,
    agents: db.all("SELECT id, name, monthly_lead_cap FROM advisors WHERE active = 1 AND COALESCE(status,'approved') = 'approved' AND is_demo = 0 ORDER BY name").map((a) => {
      const assigned = db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND assigned_at >= ?', [a.id, monthFrom]) || 0;
      const worked = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND assigned_at >= ? AND status IN (${stages.WORKED.map((s) => `'${s}'`).join(',')})`, [a.id, monthFrom]) || 0;
      const won = db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND won_at >= ?', [a.id, monthFrom]) || 0;
      const open = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND status IN ${stages.OPEN_SQL}`, [a.id]) || 0;
      return { name: a.name, assigned, cap: a.monthly_lead_cap, worked, won, open, contactRate: pct(worked, assigned) };
    }),
  };
  r.mode = routing.MODES[settings.get('assignment_mode')] || settings.get('assignment_mode');
  return r;
}

const list = (rows) => (rows.length ? rows.map((x, i) => `${i + 1}. ${x.label} — **${x.n}**`).join('\n') : '_None yet_');

function render(r) {
  const site = settings.get('site_name');
  const body = [
    `## ${site} daily lead report — ${r.date}`,
    `| | Leads (people) | Requests | Repeat requests | Policies won |\n|---|---:|---:|---:|---:|\n` +
      `| **Yesterday** | **${r.day.leads}** (${delta(r.day.leads, r.dayBefore.leads)} vs day before) | ${r.day.inquiries} | ${r.day.repeats} | ${r.day.won} |\n` +
      `| **Last 7 days** | **${r.week.leads}** (${delta(r.week.leads, r.weekBefore.leads)} vs previous 7) | ${r.week.inquiries} | ${r.week.repeats} | ${r.week.won} |\n` +
      `| **${r.monthLabel} to date** | **${r.month.leads}** (${delta(r.month.leads, r.monthBefore.leads)} vs same days last month) | ${r.month.inquiries} | ${r.month.repeats} | ${r.month.won} |`,
    `**Needs attention:** ${r.unassigned} unassigned open lead${r.unassigned === 1 ? '' : 's'} · ${r.stale} assigned lead${r.stale === 1 ? '' : 's'} still “new” after 24 hours · ${r.overdueTasks} overdue follow-up${r.overdueTasks === 1 ? '' : 's'}${r.pendingAgents ? ` · ${r.pendingAgents} agent registration${r.pendingAgents === 1 ? '' : 's'} awaiting approval` : ''}`,
    '### Top requests, last 7 days',
    `**By province**\n\n${list(r.topProvinces)}`,
    `**By city**\n\n${list(r.topCities)}`,
    `**By product**\n\n${list(r.topProducts)}`,
    r.topServices.length ? `**Specialist services and desks**\n\n${list(r.topServices)}` : '',
    `**By request type**\n\n${list(r.types)}`,
    `**By traffic source**\n\n${list(r.sources)}`,
    `**Lead grades:** ${r.grades.map((g) => `${g.g} ${g.n}`).join(' · ') || '—'}`,
    r.otp.started ? `**SMS confirmation:** ${r.otp.verified} of ${r.otp.started} submissions confirmed their number (${pct(r.otp.verified, r.otp.started)})` : '',
    `### Pipeline for leads received in ${r.monthLabel}`,
    r.funnel.map((f) => `${f.label}: **${f.n}**`).join(' · '),
    `### Agents in ${r.monthLabel}`,
    r.agents.length
      ? `| Agent | Leads / cap | Worked | Contact rate | Won | Open now |\n|---|---:|---:|---:|---:|---:|\n` + r.agents.map((a) => `| ${a.name} | ${a.assigned}${a.cap ? ` / ${a.cap}` : ''} | ${a.worked} | ${a.contactRate} | ${a.won} | ${a.open} |`).join('\n')
      : '_No approved agents yet._',
    `Distribution: ${r.mode}.`,
    `[Open the dashboard](${config.siteUrl}/admin/) · [Leads](${config.siteUrl}/admin/leads) · [Agents](${config.siteUrl}/admin/advisors)`,
  ].filter(Boolean);
  return { subject: `${site} leads ${r.date}: ${r.day.leads} new yesterday, ${r.week.leads} this week, ${r.month.leads} in ${r.monthLabel}`, bodyMd: body.join('\n\n') };
}

function recipients() {
  const users = db.all('SELECT email FROM users WHERE active = 1 AND daily_report = 1').map((u) => u.email);
  return [...new Set([...users, ...(settings.get('report_extra_emails') || [])].map((e) => String(e).trim().toLowerCase()).filter((e) => U.isEmail(e)))];
}

async function sendDaily({ now = new Date() } = {}) {
  const to = recipients();
  const { subject, bodyMd } = render(build(now));
  const results = [];
  for (const addr of to) results.push(await mailer.sendEmail({ to: addr, kind: 'notification', track: false, subject, bodyMd }));
  settings.set('daily_report_last', U.localDate(now));
  db.insert('audit_log', { action: 'send', entity: 'daily_report', entity_id: U.localDate(now), data: { recipients: to.length } });
  return { to, results };
}

/** Called from the scheduler heartbeat: sends once per Toronto day after the configured hour. */
async function maybeSendDaily(now = new Date()) {
  const hour = Number(settings.get('daily_report_hour', 7));
  if (U.localHour(now) < hour) return null;
  if (settings.get('daily_report_last') === U.localDate(now)) return null;
  if (!recipients().length) { settings.set('daily_report_last', U.localDate(now)); return null; }
  return sendDaily({ now });
}

module.exports = { build, render, recipients, sendDaily, maybeSendDaily };
