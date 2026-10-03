'use strict';
/** SEO manager: page overrides, redirects, 404 monitor, keyword map, indexation, crawlers, IndexNow. */
const express = require('express');
const db = require('../../db');
const auth = require('../../lib/auth');
const seo = require('../../lib/seo');
const pages = require('../../lib/pages');
const cache = require('../../lib/cache');
const indexnow = require('../../lib/indexnow');
const settings = require('../../lib/settings');
const crawlers = require('../../lib/crawlers');
const { products } = require('../../data/products');
const geo = require('../../data/geo');
const { csvCell } = require('../../lib/util');

const router = express.Router();
router.use('/seo', auth.requireRole('editor'));

function purge() {
  seo.clearOverrides(); pages.invalidate(); cache.clear();
  try { require('../system').clearMemo(); } catch { /* ignore */ }
}

router.get('/seo', (req, res) => {
  const all = pages.allPages();
  const byType = {};
  for (const p of all) { byType[p.type] = byType[p.type] || { total: 0, indexable: 0 }; byType[p.type].total++; if (p.indexable) byType[p.type].indexable++; }
  const kw = db.get(`SELECT COUNT(*) total, SUM(CASE WHEN target_path IS NULL OR target_path = '' THEN 1 ELSE 0 END) unmapped, SUM(COALESCE(volume,0)) volume FROM keywords`);
  const posts = db.get(`SELECT COUNT(*) n, ROUND(AVG(seo_score)) avg, SUM(CASE WHEN seo_score < 70 THEN 1 ELSE 0 END) weak FROM posts WHERE status = 'published'`);
  const crawl = db.all("SELECT bot, kind, COUNT(*) n, MAX(ts) last FROM crawler_hits WHERE ts >= datetime('now','-30 days') GROUP BY bot, kind ORDER BY n DESC");
  res.admin('seo', {
    title: 'SEO & AI visibility', byType, totalPages: all.length, indexable: all.filter((p) => p.indexable).length, kw, posts, crawl,
    notFound: db.all('SELECT * FROM not_found ORDER BY hits DESC LIMIT 10'),
    indexLog: db.all('SELECT * FROM indexnow_log ORDER BY id DESC LIMIT 10'),
    robots: crawlers.robots(), s: settings.all(), indexNowEnabled: require('../../config').indexNowEnabled,
  });
});

// ───────────── Page overrides ─────────────
router.get('/seo/pages', (req, res) => {
  const type = req.query.type || '';
  const q = String(req.query.q || '').toLowerCase();
  const ov = Object.fromEntries(db.all('SELECT * FROM seo_overrides').map((r) => [r.path, r]));
  let list = pages.allPages().filter((p) => (!type || p.type === type) && (!q || p.path.includes(q) || (p.title || '').toLowerCase().includes(q)));
  if (req.query.indexable === '0') list = list.filter((p) => !p.indexable);
  if (req.query.indexable === '1') list = list.filter((p) => p.indexable);
  if (req.query.overridden) list = list.filter((p) => ov[p.path]);
  res.admin('seo-pages', { title: 'Pages & overrides', list: list.slice(0, 500), count: list.length, ov, q: req.query });
});

router.get('/seo/page', (req, res) => {
  const path = String(req.query.path || '/');
  const row = db.get('SELECT * FROM seo_overrides WHERE path = ?', [path]) || { path };
  row.faqText = (db.json(row.faq, []) || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
  res.admin('seo-page', { title: `SEO: ${path}`, row, path });
});

router.post('/seo/page', (req, res) => {
  const b = req.body;
  const path = String(b.path || '').trim();
  if (!path.startsWith('/')) return res.redirect(303, '/admin/seo/pages?_err=Path+must+start+with+/');
  const faq = [];
  let cur = null;
  for (const line of String(b.faq || '').split('\n')) {
    const t = line.trim();
    if (/^q:/i.test(t)) { if (cur && cur.a) faq.push(cur); cur = { q: t.slice(2).trim(), a: '' }; } else if (/^a:/i.test(t) && cur) cur.a = t.slice(2).trim(); else if (t && cur && cur.a) cur.a += ' ' + t;
  }
  if (cur && cur.a) faq.push(cur);
  if (b.schema_json) { try { JSON.parse(b.schema_json); } catch { return res.redirect(303, `/admin/seo/page?path=${encodeURIComponent(path)}&_err=Schema+JSON+is+invalid`); } }
  const row = {
    title: String(b.title || '').trim() || null, description: String(b.description || '').trim() || null, canonical: String(b.canonical || '').trim() || null,
    robots: String(b.robots || '').trim() || null, og_image: String(b.og_image || '').trim() || null, h1: String(b.h1 || '').trim() || null,
    intro_md: String(b.intro_md || '').trim() || null, faq: faq.length ? JSON.stringify(faq) : null, schema_json: String(b.schema_json || '').trim() || null,
  };
  if (b.remove) db.run('DELETE FROM seo_overrides WHERE path = ?', [path]);
  else db.run(`INSERT INTO seo_overrides(path, title, description, canonical, robots, og_image, h1, intro_md, faq, schema_json, updated_at)
      VALUES(@path, @title, @description, @canonical, @robots, @og_image, @h1, @intro_md, @faq, @schema_json, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET title=excluded.title, description=excluded.description, canonical=excluded.canonical, robots=excluded.robots, og_image=excluded.og_image,
      h1=excluded.h1, intro_md=excluded.intro_md, faq=excluded.faq, schema_json=excluded.schema_json, updated_at=CURRENT_TIMESTAMP`, { path, ...row });
  purge();
  res.locals.audit(b.remove ? 'remove' : 'save', 'seo_override', path);
  if (b.ping) indexnow.ping([path]).catch(() => {});
  res.redirect(303, `/admin/seo/page?path=${encodeURIComponent(path)}&_ok=${b.remove ? 'Override+removed' : 'Saved+—+live+now'}`);
});

// ───────────── Redirects & 404s ─────────────
router.get('/seo/redirects', (req, res) => {
  res.admin('seo-redirects', { title: 'Redirects & 404s', rows: db.all('SELECT * FROM redirects ORDER BY id DESC'), notFound: db.all('SELECT * FROM not_found ORDER BY hits DESC LIMIT 100'), prefill: req.query.from || '' });
});
router.post('/seo/redirects', (req, res) => {
  const from = String(req.body.from_path || '').trim(), to = String(req.body.to_path || '').trim();
  const code = [301, 302, 308, 410].includes(Number(req.body.code)) ? Number(req.body.code) : 301;
  if (!from.startsWith('/') || (!to.startsWith('/') && !/^https?:\/\//.test(to))) return res.redirect(303, '/admin/seo/redirects?_err=Paths+must+start+with+/');
  if (from === to) return res.redirect(303, '/admin/seo/redirects?_err=A+redirect+cannot+point+to+itself');
  db.run('INSERT INTO redirects(from_path, to_path, code) VALUES(?, ?, ?) ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path, code = excluded.code', [from, to, code]);
  db.run('DELETE FROM not_found WHERE path = ?', [from]);
  require('../../app').invalidateRedirects(); cache.clear();
  res.locals.audit('save', 'redirect', from, { to, code });
  res.redirect(303, '/admin/seo/redirects?_ok=Redirect+saved');
});
router.post('/seo/redirects/:id/delete', (req, res) => {
  db.run('DELETE FROM redirects WHERE id = ?', [Number(req.params.id)]);
  require('../../app').invalidateRedirects();
  res.redirect(303, '/admin/seo/redirects?_ok=Deleted');
});
router.post('/seo/404/clear', (req, res) => { db.run('DELETE FROM not_found'); res.redirect(303, '/admin/seo/redirects?_ok=404+log+cleared'); });

// ───────────── Keyword map ─────────────
router.get('/seo/keywords', (req, res) => {
  const where = []; const params = [];
  for (const k of ['level', 'product', 'province', 'intent', 'cluster']) if (req.query[k]) { where.push(`${k} = ?`); params.push(req.query[k]); }
  if (req.query.unmapped) where.push("(target_path IS NULL OR target_path = '')");
  if (req.query.q) { where.push('keyword LIKE ?'); params.push(`%${req.query.q}%`); }
  const sort = { volume: 'volume DESC', priority: 'priority ASC, volume DESC', keyword: 'keyword ASC', difficulty: 'difficulty ASC' }[req.query.sort] || 'priority ASC, volume DESC';
  const rows = db.all(`SELECT * FROM keywords ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${sort} LIMIT 1000`, params);
  const clusters = db.all('SELECT cluster, COUNT(*) n, SUM(volume) v FROM keywords GROUP BY cluster ORDER BY v DESC');
  res.admin('seo-keywords', { title: 'Keyword map', rows, clusters, q: req.query, products, provinces: geo.provinces });
});
router.post('/seo/keywords', (req, res) => {
  const b = req.body;
  const row = {
    keyword: String(b.keyword || '').trim().toLowerCase(), level: ['national', 'provincial', 'local'].includes(b.level) ? b.level : 'national',
    product: b.product || null, province: b.province || null, city: b.city || null, volume: b.volume ? Number(b.volume) : null,
    volume_source: b.volume_source || 'manual', difficulty: b.difficulty ? Number(b.difficulty) : null, intent: b.intent || null, cluster: b.cluster || null,
    competitors: b.competitors || null, target_path: b.target_path || null, priority: Number(b.priority) || 3, rank: b.rank ? Number(b.rank) : null, notes: b.notes || null,
    updated_at: new Date().toISOString(),
  };
  if (!row.keyword) return res.redirect(303, '/admin/seo/keywords?_err=Keyword+required');
  if (b.id) db.update('keywords', Number(b.id), row);
  else db.run(`INSERT INTO keywords(keyword, level, product, province, city, volume, volume_source, difficulty, intent, cluster, competitors, target_path, priority, rank, notes)
    VALUES(@keyword, @level, @product, @province, @city, @volume, @volume_source, @difficulty, @intent, @cluster, @competitors, @target_path, @priority, @rank, @notes)
    ON CONFLICT(keyword) DO UPDATE SET volume = excluded.volume, volume_source = excluded.volume_source, target_path = COALESCE(excluded.target_path, keywords.target_path), rank = COALESCE(excluded.rank, keywords.rank)`, row);
  res.redirect(303, `/admin/seo/keywords?_ok=Saved${b.return ? '&' + String(b.return) : ''}`);
});
/** Import CSV exported from Keyword Planner / Ahrefs / Semrush: keyword,volume[,difficulty][,rank][,target_path] */
router.post('/seo/keywords/import', (req, res) => {
  const lines = String(req.body.csv || '').split(/\r?\n/).filter(Boolean);
  let n = 0;
  for (const line of lines) {
    const cells = line.split(/[,\t]/).map((c) => c.replace(/^"|"$/g, '').trim());
    if (!cells[0] || /^keyword$/i.test(cells[0])) continue;
    const vol = Number(String(cells[1] || '').replace(/[^0-9.]/g, ''));
    db.run(`INSERT INTO keywords(keyword, level, volume, volume_source, difficulty, rank, target_path) VALUES(?, 'national', ?, ?, ?, ?, ?)
      ON CONFLICT(keyword) DO UPDATE SET volume = excluded.volume, volume_source = excluded.volume_source, difficulty = COALESCE(excluded.difficulty, keywords.difficulty), rank = COALESCE(excluded.rank, keywords.rank), target_path = COALESCE(excluded.target_path, keywords.target_path), updated_at = CURRENT_TIMESTAMP`,
    [cells[0].toLowerCase(), Number.isFinite(vol) && vol ? vol : null, String(req.body.source || 'import').slice(0, 40), cells[2] ? Number(cells[2]) : null, cells[3] ? Number(cells[3]) : null, cells[4] || null]);
    n++;
  }
  res.redirect(303, `/admin/seo/keywords?_ok=${n}+keywords+imported`);
});
router.get('/seo/keywords.csv', (req, res) => {
  const rows = db.all('SELECT * FROM keywords ORDER BY priority, volume DESC');
  const cols = ['keyword', 'level', 'product', 'province', 'city', 'volume', 'volume_source', 'difficulty', 'intent', 'cluster', 'competitors', 'target_path', 'priority', 'rank', 'notes'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="instasure-keywords.csv"' });
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'));
});
router.post('/seo/keywords/:id/delete', (req, res) => { db.run('DELETE FROM keywords WHERE id = ?', [Number(req.params.id)]); res.redirect(303, '/admin/seo/keywords?_ok=Deleted'); });

// ───────────── Crawlers & IndexNow ─────────────
router.get('/seo/crawlers', (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = `-${days} days`;
  res.admin('seo-crawlers', {
    title: 'Search & AI crawlers', days,
    byBot: db.all('SELECT bot, kind, COUNT(*) n, MAX(ts) last FROM crawler_hits WHERE ts >= datetime(\'now\', ?) GROUP BY bot, kind ORDER BY n DESC', [since]),
    topPaths: db.all("SELECT path, COUNT(*) n, GROUP_CONCAT(DISTINCT bot) bots FROM crawler_hits WHERE kind LIKE 'ai_%' AND ts >= datetime('now', ?) GROUP BY path ORDER BY n DESC LIMIT 40", [since]),
    errors: db.all("SELECT path, bot, status, COUNT(*) n FROM crawler_hits WHERE status >= 400 AND ts >= datetime('now', ?) GROUP BY path, bot, status ORDER BY n DESC LIMIT 30", [since]),
    aiReferrals: db.all("SELECT referrer_host, COUNT(*) n FROM pageviews WHERE source = 'ai' AND ts >= datetime('now', ?) GROUP BY referrer_host ORDER BY n DESC", [since]),
  });
});
router.post('/seo/indexnow', auth.requireRole('editor'), async (req, res) => {
  const paths = String(req.body.paths || '').split(/\s+/).filter((p) => p.startsWith('/')).slice(0, 1000);
  const r = await indexnow.ping(paths.length ? paths : ['/']);
  res.redirect(303, `/admin/seo?_ok=${encodeURIComponent(`IndexNow: ${r.status || r.skipped || r.error}`)}`);
});
router.post('/seo/purge', (req, res) => { purge(); res.redirect(303, '/admin/seo?_ok=Caches+purged'); });

module.exports = router;
