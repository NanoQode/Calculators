'use strict';
/**
 * Merge leads that belong to the same person (same email, or the same valid mobile number when
 * phone matching is on) into one record.
 *
 * The earliest record survives: it keeps its reference and original attribution. From the others it
 * takes any missing contact details, every product asked about (as inquiries), the furthest-along
 * stage, its agent if it had none, the strongest consent, and their timeline, emails, enrolments
 * and tasks. Their references keep working (lead_refs), so old result links and unsubscribe links
 * still resolve. An unsubscribe on any of them stays an unsubscribe.
 */
const db = require('../db');
const settings = require('./settings');
const scoring = require('./scoring');
const stages = require('./stages');
const { bySlug } = require('../data/products');
const { normPhone, sqlNow } = require('./util');
const { ANONYMISED, TYPE_RANK, productsOf, valueOf } = require('./leads');

/** Groups of lead ids that look like the same person (union of email and phone matches). */
function groups() {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); };
  const add = (ids) => { for (const id of ids) if (!parent.has(id)) parent.set(id, id); for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]); };

  for (const r of db.all(`SELECT GROUP_CONCAT(id) ids FROM leads WHERE NOT ${ANONYMISED} AND email IS NOT NULL AND email != '' GROUP BY lower(email) HAVING COUNT(*) > 1`)) add(r.ids.split(',').map(Number));
  if (settings.get('lead_match_phone') !== false) {
    const byPhone = new Map();
    for (const r of db.all(`SELECT id, phone, first_name FROM leads WHERE NOT ${ANONYMISED} AND phone IS NOT NULL AND phone != ''`)) {
      const p = normPhone(r.phone); if (!p) continue;
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p).push(r);
    }
    // Same number, different first names = a shared household number: those stay separate people.
    for (const rows of byPhone.values()) {
      if (rows.length < 2) continue;
      const named = new Map();
      for (const r of rows) { const k = String(r.first_name || '').trim().toLowerCase().normalize('NFKD').replace(/[^a-z]/g, ''); if (k) { if (!named.has(k)) named.set(k, []); named.get(k).push(r.id); } }
      const blanks = rows.filter((r) => !String(r.first_name || '').trim()).map((r) => r.id);
      const clusters = [...named.values()].sort((a, b) => b.length - a.length);
      if (clusters.length) clusters[0].push(...blanks); else clusters.push(blanks);
      for (const ids of clusters) if (ids.length > 1) add(ids);
    }
  }
  const out = new Map();
  for (const id of parent.keys()) { const r = find(id); if (!out.has(r)) out.set(r, []); out.get(r).push(id); }
  return [...out.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a - b));
}

/** The groups with their lead rows, for the admin review page. */
function preview(limit = 200) {
  return groups().slice(0, limit).map((ids) => ({
    ids,
    leads: db.all(`SELECT l.*, a.name AS advisor_name FROM leads l LEFT JOIN advisors a ON a.id = l.advisor_id WHERE l.id IN (${ids.map(() => '?').join(',')}) ORDER BY l.created_at, l.id`, ids),
  }));
}

/** Legacy leads have no inquiry rows: give each one an inquiry for its own request before merging. */
function ensureInitialInquiry(lead) {
  if (db.value('SELECT COUNT(*) FROM lead_inquiries WHERE lead_id = ?', [lead.id])) return;
  db.insert('lead_inquiries', {
    lead_id: lead.id, ref: lead.ref, origin: 'submission', lead_type: lead.lead_type, product: lead.product, product_category: lead.product_category, service: lead.service,
    quote_inputs: lead.quote_inputs || '{}', estimate: lead.estimate || '{}', timeframe: lead.timeframe, message: lead.message, source: lead.source,
    utm_source: lead.utm_source, utm_medium: lead.utm_medium, utm_campaign: lead.utm_campaign, landing_page: lead.landing_page, page_path: lead.page_path, created_at: lead.created_at,
  });
}

const FILL = ['first_name', 'last_name', 'phone', 'province', 'city', 'postal_code', 'timeframe', 'best_time', 'message', 'utm_source', 'utm_medium', 'utm_campaign', 'landing_page', 'referrer', 'visitor_id'];
const earliest = (...v) => v.filter(Boolean).sort()[0] || null;
const latest = (...v) => v.filter(Boolean).sort().slice(-1)[0] || null;

/** Merge the given leads into the earliest one. Returns { primary, merged: [refs] }. */
function mergeGroup(ids, { userId } = {}) {
  const list = [...new Set(ids.map(Number))];
  if (list.length < 2) return null;
  return db.tx(() => {
    const rows = db.all(`SELECT * FROM leads WHERE id IN (${list.map(() => '?').join(',')}) ORDER BY created_at, id`, list);
    if (rows.length < 2) return null;
    const [primary, ...others] = rows;
    for (const r of rows) ensureInitialInquiry(r);

    const patch = {};
    const products = productsOf(primary);
    let status = primary.status;
    let advisorId = primary.advisor_id, assignedAt = primary.assigned_at;
    let consent = primary.consent_marketing ? { at: primary.consent_at, text: primary.consent_text } : null;
    let unsubscribed = primary.unsubscribed_at;
    for (const d of others) {
      for (const k of FILL) if (!primary[k] && !patch[k] && d[k]) patch[k] = d[k];
      if (!primary.product && !patch.product && d.product) Object.assign(patch, { product: d.product, product_category: d.product_category, service: d.service, quote_inputs: d.quote_inputs, estimate: d.estimate });
      for (const p of productsOf(d)) if (!products.includes(p)) products.push(p);
      if ((stages.RANK[d.status] ?? 0) > (stages.RANK[status] ?? 0)) status = d.status;
      if (!advisorId && d.advisor_id) { advisorId = d.advisor_id; assignedAt = d.assigned_at || d.updated_at; }
      if (d.consent_marketing && (!consent || String(d.consent_at || '') > String(consent.at || ''))) consent = { at: d.consent_at, text: d.consent_text };
      unsubscribed = earliest(unsubscribed, d.unsubscribed_at) || unsubscribed;
      if (d.phone_verified_at && !primary.phone_verified_at && (!primary.phone || normPhone(primary.phone) === normPhone(d.phone))) patch.phone_verified_at = d.phone_verified_at;
    }
    Object.assign(patch, {
      products, value_estimate: valueOf(products) || primary.value_estimate, status, advisor_id: advisorId, assigned_at: assignedAt,
      contacted_at: earliest(primary.contacted_at, ...others.map((d) => d.contacted_at)),
      won_at: earliest(primary.won_at, ...others.map((d) => d.won_at)),
      last_activity_at: latest(primary.last_activity_at, primary.updated_at, ...others.map((d) => d.last_activity_at || d.updated_at)),
      lead_type: rows.map((r) => r.lead_type).sort((a, b) => (TYPE_RANK[b] || 0) - (TYPE_RANK[a] || 0))[0],
      is_test: rows.every((r) => r.is_test) ? 1 : 0,
      score_adjustment: Math.max(...rows.map((r) => Number(r.score_adjustment) || 0)),
      updated_at: sqlNow(),
    });
    if (unsubscribed) Object.assign(patch, { unsubscribed_at: unsubscribed, consent_marketing: 0 });
    else if (consent) Object.assign(patch, { consent_marketing: 1, consent_at: consent.at, consent_text: consent.text });

    const otherIds = others.map((d) => d.id);
    const marks = otherIds.map(() => '?').join(',');
    // Same campaign on both records: keep the survivor's enrolment, drop the duplicate's.
    db.run(`DELETE FROM enrollments WHERE lead_id IN (${marks}) AND campaign_id IN (SELECT campaign_id FROM enrollments WHERE lead_id = ?)`, [...otherIds, primary.id]);
    db.run(`DELETE FROM enrollments WHERE lead_id IN (${marks}) AND id NOT IN (SELECT MIN(id) FROM enrollments WHERE lead_id IN (${marks}) GROUP BY campaign_id)`, [...otherIds, ...otherIds]);
    for (const t of ['lead_events', 'emails', 'enrollments', 'lead_inquiries', 'lead_tasks', 'lead_refs']) db.run(`UPDATE ${t} SET lead_id = ? WHERE lead_id IN (${marks})`, [primary.id, ...otherIds]);
    db.run(`UPDATE lead_inquiries SET origin = 'merge' WHERE lead_id = ? AND ref IN (${marks})`, [primary.id, ...others.map((d) => d.ref)]);
    db.run(`UPDATE otp_requests SET lead_id = ? WHERE lead_id IN (${marks})`, [primary.id, ...otherIds]);
    for (const d of others) db.run('INSERT OR REPLACE INTO lead_refs(ref, lead_id) VALUES(?, ?)', [d.ref, primary.id]);
    db.run(`DELETE FROM leads WHERE id IN (${marks})`, otherIds);

    patch.inquiry_count = db.value('SELECT COUNT(*) FROM lead_inquiries WHERE lead_id = ?', [primary.id]) || rows.length;
    db.update('leads', primary.id, patch);
    db.insert('lead_events', { lead_id: primary.id, type: 'merged', user_id: userId, data: {
      merged: others.map((d) => d.ref), note: `Merged ${others.length} duplicate record${others.length > 1 ? 's' : ''} (${others.map((d) => d.ref).join(', ')}) into this lead`,
      products: products.map((p) => (bySlug[p] || {}).short || p),
    } });
    scoring.rescore(primary.id, 'merged duplicates');
    return { primary: db.get('SELECT * FROM leads WHERE id = ?', [primary.id]), merged: others.map((d) => d.ref) };
  });
}

/** Merge every duplicate group. Returns { groups, merged } counts. */
function mergeAll({ userId } = {}) {
  let n = 0, m = 0;
  for (const ids of groups()) {
    const r = mergeGroup(ids, { userId });
    if (r) { n++; m += r.merged.length; }
  }
  return { groups: n, merged: m };
}

module.exports = { groups, preview, mergeGroup, mergeAll, ensureInitialInquiry };
