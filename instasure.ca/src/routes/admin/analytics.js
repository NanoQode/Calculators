'use strict';
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const charts = require('../../lib/charts');
const { bySlug } = require('../../data/products');
const geo = require('../../data/geo');
const { num, money } = require('../../lib/util');

const router = express.Router();

router.get('/analytics', auth.requireRole('viewer'), (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = `-${days} days`;
  const { daysSeries } = require('./index');
  const leadWhere = "is_test = 0 AND created_at >= datetime('now', ?)";

  const sessions = db.value("SELECT COUNT(DISTINCT session_id) FROM pageviews WHERE session_id IS NOT NULL AND ts >= datetime('now', ?)", [since]) || 0;
  const visitors = db.value("SELECT COUNT(DISTINCT visitor_id) FROM pageviews WHERE visitor_id IS NOT NULL AND ts >= datetime('now', ?)", [since]) || 0;
  const pageviews = db.value("SELECT COUNT(*) FROM pageviews WHERE ts >= datetime('now', ?)", [since]) || 0;
  const leads = db.value(`SELECT COUNT(*) FROM leads WHERE ${leadWhere} AND lead_type != 'partial'`, [since]) || 0;
  const quoteStarts = db.value("SELECT COUNT(*) FROM events WHERE name = 'quote_start' AND ts >= datetime('now', ?)", [since]) || 0;
  const step2 = db.value("SELECT COUNT(*) FROM events WHERE name = 'quote_step' AND json_extract(data,'$.step') = 2 AND ts >= datetime('now', ?)", [since]) || 0;
  const step3 = db.value("SELECT COUNT(*) FROM events WHERE name = 'quote_step' AND json_extract(data,'$.step') = 3 AND ts >= datetime('now', ?)", [since]) || 0;
  const quotes = db.value(`SELECT COUNT(*) FROM leads WHERE ${leadWhere} AND lead_type = 'quote'`, [since]) || 0;
  const contacted = db.value(`SELECT COUNT(*) FROM leads WHERE ${leadWhere} AND status IN ('contacted','quoted','application','won')`, [since]) || 0;
  const won = db.value(`SELECT COUNT(*) FROM leads WHERE ${leadWhere} AND status = 'won'`, [since]) || 0;

  const pvSeries = daysSeries("SELECT substr(ts,1,10) d, COUNT(DISTINCT session_id) n FROM pageviews WHERE ts >= datetime('now', ?) GROUP BY d", [since], Math.min(days, 90));
  const leadSeries = daysSeries(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM leads WHERE ${leadWhere} AND lead_type != 'partial' GROUP BY d`, [since], Math.min(days, 90));

  const landing = db.all(`SELECT p.path, COUNT(DISTINCT p.session_id) sessions,
      (SELECT COUNT(*) FROM leads l WHERE l.is_test = 0 AND l.landing_page = p.path AND l.created_at >= datetime('now', ?)) leads
    FROM pageviews p WHERE p.is_entry = 1 AND p.ts >= datetime('now', ?) GROUP BY p.path ORDER BY sessions DESC LIMIT 25`, [since, since]);
  const leadPages = db.all(`SELECT COALESCE(landing_page,'(unknown)') path, COUNT(*) leads, ROUND(AVG(score)) score, SUM(value_estimate) value FROM leads WHERE ${leadWhere} AND lead_type != 'partial' GROUP BY landing_page ORDER BY leads DESC LIMIT 25`, [since]);
  const sources = db.all(`SELECT COALESCE(source,'direct') source, COUNT(*) sessions FROM pageviews WHERE is_entry = 1 AND ts >= datetime('now', ?) GROUP BY source ORDER BY sessions DESC`, [since]);
  const leadSources = Object.fromEntries(db.all(`SELECT COALESCE(source,'direct') s, COUNT(*) n, ROUND(AVG(score)) sc FROM leads WHERE ${leadWhere} GROUP BY source`, [since]).map((r) => [r.s, r]));
  const products = db.all(`SELECT product, COUNT(*) n, ROUND(AVG(score)) score, SUM(value_estimate) value, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) won FROM leads WHERE ${leadWhere} AND product IS NOT NULL GROUP BY product ORDER BY n DESC`, [since]);
  const provinces = db.all(`SELECT province, COUNT(*) n, ROUND(AVG(score)) score FROM leads WHERE ${leadWhere} AND province IS NOT NULL GROUP BY province ORDER BY n DESC`, [since]);
  const grades = db.all(`SELECT grade, COUNT(*) n FROM leads WHERE ${leadWhere} GROUP BY grade ORDER BY grade`, [since]);
  const devices = db.all("SELECT device, COUNT(DISTINCT session_id) n FROM pageviews WHERE ts >= datetime('now', ?) GROUP BY device", [since]);
  const campaigns = db.all(`SELECT c.name, COUNT(e.id) sent, SUM(CASE WHEN e.open_count > 0 THEN 1 ELSE 0 END) opened, SUM(CASE WHEN e.click_count > 0 THEN 1 ELSE 0 END) clicked,
      (SELECT COUNT(*) FROM enrollments en WHERE en.campaign_id = c.id AND en.status = 'unsubscribed') unsub
    FROM campaigns c LEFT JOIN enrollments en ON en.campaign_id = c.id LEFT JOIN emails e ON e.enrollment_id = en.id AND e.status IN ('sent','logged') AND e.created_at >= datetime('now', ?)
    GROUP BY c.id ORDER BY sent DESC`, [since]);
  const searches = db.all("SELECT json_extract(data,'$.q') q, COUNT(*) n, MAX(json_extract(data,'$.n')) results FROM events WHERE name = 'search' AND ts >= datetime('now', ?) GROUP BY q ORDER BY n DESC LIMIT 20", [since]);
  const ctas = db.all("SELECT json_extract(data,'$.label') label, name, COUNT(*) n FROM events WHERE name IN ('cta_click','booking_click','phone_click') AND ts >= datetime('now', ?) GROUP BY label, name ORDER BY n DESC LIMIT 15", [since]);

  res.admin('analytics', {
    title: 'Lead analytics', days, sessions, visitors, pageviews, leads, quotes, won, cvr: sessions ? (leads / sessions) * 100 : 0,
    sessionsChart: charts.line(pvSeries, { label: 'Sessions' }), leadsChart: charts.bars(leadSeries, { label: 'Leads' }), pvSeries, leadSeries,
    funnel: charts.funnel([
      { label: 'Sessions', value: sessions }, { label: 'Quote started', value: quoteStarts }, { label: 'Reached step 2', value: step2 },
      { label: 'Reached contact step', value: step3 }, { label: 'Quote submitted', value: quotes }, { label: 'Contacted by advisor', value: contacted }, { label: 'Won', value: won },
    ]),
    landing, leadPages, sources, leadSources, products, provinces, grades, devices, campaigns, searches, ctas, bySlug, geo, num, money,
    gradeBars: charts.hbars(grades.map((g) => ({ label: `Grade ${g.grade || '—'}`, value: g.n }))),
    productBars: charts.hbars(products.map((p) => ({ label: (bySlug[p.product] || {}).name || p.product, value: p.n, extra: `avg score ${p.score}` }))),
    provinceBars: charts.hbars(provinces.map((p) => ({ label: (geo.provinceByCode[p.province] || {}).name || p.province, value: p.n }))),
  });
});

module.exports = router;
