'use strict';
/**
 * Agent portal: self-registration, approval and performance.
 *
 * An agent is a row in `advisors` (the routing pool) plus a `users` login with role 'advisor'.
 * Registrations start as status 'pending' and inactive: they can sign in and see their profile,
 * but get no leads and no public profile until an admin or agent manager approves them.
 */
const db = require('../db');
const auth = require('./auth');
const settings = require('./settings');
const media = require('./media');
const mailer = require('./mailer');
const config = require('../config');
const geo = require('../data/geo');
const { CATEGORIES } = require('../data/products');
const stages = require('./stages');
const U = require('./util');

class AgentError extends Error { constructor(m, field) { super(m); this.field = field; this.status = 422; } }

/** Regulator per province, used to label the licence entries created at registration. */
function regulatorFor(code) { const p = geo.provinceByCode[code]; return p && p.regulator ? p.regulator.short || p.regulator.name : ''; }

function uniqueSlug(name) {
  const base = U.slugify(name) || 'agent';
  let slug = base; let i = 1;
  while (db.get('SELECT id FROM advisors WHERE slug = ?', [slug])) slug = `${base}-${++i}`;
  return slug;
}

/**
 * Validate and create a pending agent with a login.
 * @param {object} b form fields  @param {object|null} file uploaded photo { buffer, originalname }
 */
function register(b, file) {
  const first = U.truncate(b.first_name, 60), last = U.truncate(b.last_name, 60);
  const email = U.normEmail(b.email);
  const phone = U.normPhone(b.phone);
  const licence = String(b.licence_number || '').trim().slice(0, 40);
  const provinces = U.arr(b.provinces).map((c) => String(c).toLowerCase()).filter((c) => geo.provinceByCode[c]);
  const categories = U.arr(b.categories).filter((c) => CATEGORIES[c]);
  const password = String(b.password || '');
  if (!first || !last) throw new AgentError('Enter your first and last name.', 'first_name');
  if (!U.isEmail(email)) throw new AgentError('Enter a valid email address.', 'email');
  if (!phone) throw new AgentError('Enter a 10-digit Canadian phone number.', 'phone');
  if (!/^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,39}$/.test(licence)) throw new AgentError('Enter your insurance licence number.', 'licence_number');
  if (!provinces.length) throw new AgentError('Choose at least one province you are licensed in.', 'provinces');
  if (!categories.length) throw new AgentError('Choose at least one line of insurance you are licensed for.', 'categories');
  if (password.length < 12) throw new AgentError('Choose a password of at least 12 characters.', 'password');
  if (password !== String(b.password_confirm || '')) throw new AgentError('The two passwords don’t match.', 'password_confirm');
  if (b.attest !== 'on' && b.attest !== '1') throw new AgentError('Please confirm that you are a licensed insurance professional and the details are accurate.', 'attest');
  if (!file || !file.buffer || !file.buffer.length) throw new AgentError('Add a profile photo (PNG, JPEG or WebP, up to 5 MB).', 'photo');
  if (db.get('SELECT id FROM users WHERE email = ?', [email])) throw new AgentError('An account with this email already exists. Sign in instead.', 'email');

  const name = `${first} ${last}`;
  let photo;
  try { photo = media.save(file.buffer, { originalName: file.originalname, alt: name }).url; } catch (e) { throw new AgentError(e.message, 'photo'); }
  const cap = settings.get('default_monthly_cap');
  return db.tx(() => {
    const advisorId = db.insert('advisors', {
      slug: uniqueSlug(name), name, first_name: first, last_name: last, email, phone, photo, title: 'Licensed Insurance Advisor',
      licence_number: licence, provinces, categories, languages: (() => { const l = U.arr(b.languages).filter((x) => /^[a-z]{2}$/.test(x)).slice(0, 8); return l.length ? l : ['en']; })(),
      licences: provinces.map((p) => ({ province: p, regulator: regulatorFor(p), type: 'Insurance licence (self-reported)', number: licence })),
      status: 'pending', active: 0, accepting_leads: 1, show_on_site: 0, weight: 1, max_open_leads: 150,
      monthly_lead_cap: cap === '' || cap === null || cap === undefined ? null : Number(cap), registered_at: U.sqlNow(),
    });
    const userId = db.insert('users', { email, name, password_hash: auth.hashPassword(password), role: 'advisor', advisor_id: advisorId, active: 1 });
    db.insert('audit_log', { user_id: userId, action: 'register', entity: 'advisor', entity_id: String(advisorId), data: { name, provinces, categories } });
    return { advisorId, userId, name, email };
  });
}

async function notifyManagers(agent) {
  const to = new Set(db.all("SELECT email FROM users WHERE active = 1 AND role IN ('admin','agent_manager')").map((u) => u.email));
  for (const addr of to) {
    await mailer.sendEmail({
      to: addr, kind: 'notification', track: false, subject: `New agent registration: ${agent.name}`,
      bodyMd: [`**${agent.name}** (${agent.email}) registered as an agent and is waiting for approval.`, 'Check their licence on the provincial regulator’s public register before approving.', `[Review registrations](${config.siteUrl}/admin/advisors?status=pending)`].join('\n\n'),
    });
  }
}

function setStatus(advisorId, status, { userId } = {}) {
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [advisorId]);
  if (!a) return null;
  const patch = { status, updated_at: U.sqlNow() };
  if (status === 'approved') Object.assign(patch, { active: 1, approved_at: a.approved_at || U.sqlNow(), approved_by: a.approved_by || userId || null });
  if (status === 'rejected' || status === 'suspended') patch.active = 0;
  db.update('advisors', a.id, patch);
  // A rejected agent can't sign in; a suspended one can (to see their history) but gets no leads.
  db.run('UPDATE users SET active = ? WHERE advisor_id = ? AND role = ?', [status === 'rejected' ? 0 : 1, a.id, 'advisor']);
  if (status === 'rejected') db.run("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE advisor_id = ? AND role = 'advisor')", [a.id]);
  return db.get('SELECT * FROM advisors WHERE id = ?', [a.id]);
}

async function notifyDecision(a, status) {
  if (!a.email) return;
  const site = settings.get('site_name');
  const body = status === 'approved'
    ? [`Hi ${a.first_name || a.name.split(' ')[0]},`, `Your ${site} agent account is approved. Leads in the provinces and lines you’re licensed for will now be assigned to you${a.monthly_lead_cap ? ` (up to ${a.monthly_lead_cap} a month)` : ''}.`, `[Sign in to your agent portal](${config.siteUrl}/admin/me)`]
    : [`Hi ${a.first_name || a.name.split(' ')[0]},`, status === 'rejected' ? `We weren’t able to approve your ${site} agent registration. Reply to this email if you think this is a mistake.` : `Your ${site} agent account is paused, so no new leads will be assigned for now.`];
  await mailer.sendEmail({ to: a.email, kind: 'notification', track: false, subject: status === 'approved' ? `You’re approved — welcome to ${site}` : `Your ${site} agent account`, bodyMd: body.join('\n\n') });
}

/** Conversion tracking for one agent: this month, last month, all time, the last six months and the funnel. */
function performance(advisorId, now = new Date()) {
  const m0 = U.monthStartUtc(0, now), m1 = U.monthStartUtc(-1, now);
  const worked = `(${stages.WORKED.map((s) => `'${s}'`).join(',')})`;
  const period = (from, to) => {
    const p = to ? [advisorId, from, to] : [advisorId, from];
    const range = to ? 'assigned_at >= ? AND assigned_at < ?' : 'assigned_at >= ?';
    const assigned = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND ${range}`, p) || 0;
    const contacted = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND ${range} AND status IN ${worked}`, p) || 0;
    const quoted = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND ${range} AND status IN ('quoted','application','underwriting','approved','won')`, p) || 0;
    const won = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND ${range} AND status = 'won'`, p) || 0;
    const lost = db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND ${range} AND status = 'lost'`, p) || 0;
    const value = db.value(`SELECT COALESCE(SUM(value_estimate),0) FROM leads WHERE advisor_id = ? AND ${range} AND status = 'won'`, p) || 0;
    return { assigned, contacted, quoted, won, lost, value, contactRate: assigned ? contacted / assigned : 0, quoteRate: assigned ? quoted / assigned : 0, conversion: assigned ? won / assigned : 0 };
  };
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const from = U.monthStartUtc(-i, now), to = U.monthStartUtc(-i + 1, now);
    months.push({ label: U.monthYear(new Date(U.toDate(from).getTime() + 2 * 86400000)), ...period(from, to) });
  }
  const a = db.get('SELECT * FROM advisors WHERE id = ?', [advisorId]);
  const firstTouch = db.get(`SELECT AVG((julianday(contacted_at) - julianday(assigned_at)) * 24) h FROM leads WHERE advisor_id = ? AND contacted_at IS NOT NULL AND assigned_at IS NOT NULL AND contacted_at >= assigned_at AND assigned_at >= ?`, [advisorId, U.monthStartUtc(-2, now)]);
  return {
    advisor: a,
    thisMonth: period(m0), lastMonth: period(m1, m0), allTime: period('1970-01-01'), months,
    cap: a && a.monthly_lead_cap, monthCount: db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND assigned_at >= ?', [advisorId, m0]) || 0,
    funnel: stages.STAGES.map((s) => ({ key: s.key, label: s.label, n: db.value('SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND status = ?', [advisorId, s.key]) || 0 })).filter((f) => f.n),
    open: db.value(`SELECT COUNT(*) FROM leads WHERE advisor_id = ? AND status IN ${stages.OPEN_SQL}`, [advisorId]) || 0,
    hoursToFirstContact: firstTouch && firstTouch.h !== null ? Math.round(firstTouch.h * 10) / 10 : null,
    recent: db.all('SELECT id, ref, first_name, last_name, email, product, status, score, grade, assigned_at FROM leads WHERE advisor_id = ? ORDER BY COALESCE(assigned_at, created_at) DESC LIMIT 12', [advisorId]),
  };
}

module.exports = { register, notifyManagers, setStatus, notifyDecision, performance, regulatorFor, AgentError };
