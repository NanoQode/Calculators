'use strict';
/** Guides/blog CMS with live SEO scoring and one-click "Publish now" (live + sitemap + llms.txt + IndexNow). */
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const auth = require('../../lib/auth');
const publisher = require('../../lib/publisher');
const md = require('../../lib/markdown');
const media = require('../../lib/media');
const cache = require('../../lib/cache');
const { products } = require('../../data/products');
const geo = require('../../data/geo');
const { slugify, sqlNow } = require('../../lib/util');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: media.MAX_BYTES + 1, files: 1 } });
router.use(['/posts', '/media', '/categories'], auth.requireRole('editor'));

router.get('/posts', (req, res) => {
  const where = []; const params = [];
  if (req.query.status) { where.push('p.status = ?'); params.push(req.query.status); }
  if (req.query.q) { where.push('(p.title LIKE ? OR p.focus_keyword LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.review === 'needed') where.push("p.reviewer_id IS NULL AND p.status = 'published'");
  const rows = db.all(`SELECT p.id, p.slug, p.title, p.status, p.seo_score, p.word_count, p.views, p.published_at, p.scheduled_at, p.updated_at, p.focus_keyword, p.reviewer_id,
      c.name AS category, a.name AS reviewer FROM posts p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN advisors a ON a.id = p.reviewer_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(p.updated_at, p.created_at) DESC`, params);
  const counts = db.all('SELECT status, COUNT(*) n FROM posts GROUP BY status');
  res.admin('posts', { title: 'Guides & blog', rows, counts, q: req.query, needsReview: db.value("SELECT COUNT(*) FROM posts WHERE reviewer_id IS NULL AND status = 'published'") });
});

function editorData(post) {
  return {
    post,
    cats: db.all('SELECT * FROM categories ORDER BY sort'),
    advisors: db.all('SELECT id, name, designations, is_demo FROM advisors WHERE active = 1 ORDER BY name'),
    products, provinces: geo.provinces,
    revisions: post.id ? db.all('SELECT r.id, r.created_at, r.title, u.name AS user_name FROM post_revisions r LEFT JOIN users u ON u.id = r.user_id WHERE r.post_id = ? ORDER BY r.id DESC LIMIT 20', [post.id]) : [],
    mediaList: db.all('SELECT * FROM media ORDER BY id DESC LIMIT 60'),
    siteHost: new URL(require('../../config').siteUrl).host,
  };
}

const BLANK = { id: null, title: '', slug: '', excerpt: '', body_md: '', content_type: 'guide', status: 'draft', category_id: null, author_id: null, reviewer_id: null, seo_title: '', meta_description: '', canonical: '', robots: '', focus_keyword: '', keywords: '[]', faq: '[]', takeaways: '[]', sources: '[]', products: '[]', provinces: '[]', featured_image: '', image_alt: '', scheduled_at: null };

router.get('/posts/new', (req, res) => res.admin('post-edit', { title: 'New guide', ...editorData({ ...BLANK }) }));
router.get('/posts/:id', (req, res, next) => {
  const post = db.get('SELECT * FROM posts WHERE id = ?', [Number(req.params.id)]);
  if (!post) return next();
  res.admin('post-edit', { title: `Edit: ${post.title}`, ...editorData(post) });
});

function parseLines(v) { return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean); }
function parseFaq(v) {
  // "Q: question" / "A: answer" blocks separated by blank lines
  const out = []; let cur = null;
  for (const line of String(v || '').split('\n')) {
    const t = line.trim();
    if (/^q:/i.test(t)) { if (cur && cur.q && cur.a) out.push(cur); cur = { q: t.slice(2).trim(), a: '' }; }
    else if (/^a:/i.test(t) && cur) cur.a = t.slice(2).trim();
    else if (t && cur && cur.a) cur.a += ' ' + t;
  }
  if (cur && cur.q && cur.a) out.push(cur);
  return out;
}
function parseSources(v) {
  return parseLines(v).map((l) => { const [title, url, publisher] = l.split('|').map((s) => (s || '').trim()); return { title, url, publisher }; }).filter((s) => /^https?:\/\//.test(s.url || ''));
}

function rowFromBody(b) {
  return {
    title: String(b.title || '').trim().slice(0, 200),
    slug: slugify(b.slug || b.title),
    excerpt: String(b.excerpt || '').trim().slice(0, 400),
    body_md: String(b.body_md || ''),
    content_type: ['guide', 'comparison', 'data', 'news', 'checklist'].includes(b.content_type) ? b.content_type : 'guide',
    category_id: Number(b.category_id) || null,
    author_id: Number(b.author_id) || null,
    reviewer_id: Number(b.reviewer_id) || null,
    seo_title: String(b.seo_title || '').trim().slice(0, 120) || null,
    meta_description: String(b.meta_description || '').trim().slice(0, 320) || null,
    canonical: String(b.canonical || '').trim() || null,
    robots: ['', 'noindex,follow', 'noindex,nofollow'].includes(b.robots) ? (b.robots || null) : null,
    focus_keyword: String(b.focus_keyword || '').trim().slice(0, 100) || null,
    keywords: parseLines(String(b.keywords || '').replace(/,/g, '\n')),
    takeaways: parseLines(b.takeaways),
    faq: parseFaq(b.faq),
    sources: parseSources(b.sources),
    products: [].concat(b.products || []).filter((s) => products.some((p) => p.slug === s)),
    provinces: [].concat(b.provinces || []).filter((c) => geo.provinceByCode[c]),
    featured_image: String(b.featured_image || '').trim() || null,
    image_alt: String(b.image_alt || '').trim().slice(0, 200) || null,
    last_reviewed_at: b.mark_reviewed ? sqlNow() : undefined,
  };
}

router.post('/posts', async (req, res) => {
  const b = req.body;
  const row = rowFromBody(b);
  if (!row.title) return res.redirect(303, '/admin/posts/new?_err=Title+is+required');
  const id = b.id ? Number(b.id) : null;
  const clash = db.get('SELECT id FROM posts WHERE slug = ? AND id != ?', [row.slug, id || 0]);
  if (clash) row.slug = `${row.slug}-${Date.now().toString(36).slice(-4)}`;
  let postId = id;
  const before = id ? db.get('SELECT * FROM posts WHERE id = ?', [id]) : null;
  if (before && before.slug !== row.slug && before.status === 'published') {
    // Keep old URLs working: auto 301 when a published slug changes.
    db.run('INSERT OR REPLACE INTO redirects(from_path, to_path, code) VALUES(?, ?, 301)', [`/guides/${before.slug}/`, `/guides/${row.slug}/`]);
    require('../../app').invalidateRedirects();
  }
  if (before) { publisher.snapshot(before, req.user.id); db.update('posts', id, { ...row, updated_at: sqlNow() }); }
  else postId = db.insert('posts', { ...row, status: 'draft', created_by: req.user.id, updated_at: sqlNow() });
  publisher.recompile(postId);

  const action = b.action || 'save';
  let msg = 'Saved';
  if (action === 'publish') {
    const r = await publisher.publish(postId, { userId: req.user.id });
    msg = `Published — live now${r.ping && r.ping.status ? ` · IndexNow ${r.ping.status}` : ''}`;
  } else if (action === 'schedule' && b.scheduled_at) {
    const at = new Date(b.scheduled_at);
    if (isNaN(at)) return res.redirect(303, `/admin/posts/${postId}?_err=Invalid+schedule+date`);
    db.update('posts', postId, { status: 'scheduled', scheduled_at: at.toISOString().replace('T', ' ').slice(0, 19) });
    msg = `Scheduled for ${at.toLocaleString('en-CA')}`;
  } else if (action === 'unpublish') {
    db.update('posts', postId, { status: 'draft' }); cache.clear(); msg = 'Unpublished (now a draft)';
  } else if (before && before.status === 'published') {
    cache.clear(); msg = 'Saved — live page updated';
  }
  res.locals.audit(action, 'post', postId, { title: row.title });
  res.redirect(303, `/admin/posts/${postId}?_ok=${encodeURIComponent(msg)}`);
});

router.post('/posts/:id/delete', auth.requireRole('admin'), (req, res) => {
  const p = db.get('SELECT slug, status FROM posts WHERE id = ?', [Number(req.params.id)]);
  db.run('DELETE FROM posts WHERE id = ?', [Number(req.params.id)]);
  if (p && p.status === 'published' && req.body.redirect_to) db.run('INSERT OR REPLACE INTO redirects(from_path, to_path, code) VALUES(?, ?, 301)', [`/guides/${p.slug}/`, String(req.body.redirect_to)]);
  require('../../app').invalidateRedirects(); cache.clear();
  res.locals.audit('delete', 'post', req.params.id);
  res.redirect(303, '/admin/posts?_ok=Deleted');
});

router.post('/posts/:id/restore/:rev', (req, res) => {
  const r = db.get('SELECT * FROM post_revisions WHERE id = ? AND post_id = ?', [Number(req.params.rev), Number(req.params.id)]);
  if (!r) return res.redirect(303, `/admin/posts/${req.params.id}?_err=Revision+not+found`);
  const cur = db.get('SELECT * FROM posts WHERE id = ?', [Number(req.params.id)]);
  publisher.snapshot(cur, req.user.id);
  db.update('posts', cur.id, { title: r.title, body_md: r.body_md, updated_at: sqlNow() });
  publisher.recompile(cur.id); cache.clear();
  res.redirect(303, `/admin/posts/${cur.id}?_ok=Revision+restored`);
});

/** Live preview for the editor (markdown → sanitized HTML). */
router.post('/posts/preview', (req, res) => {
  const r = md.render(String(req.body.body_md || ''));
  res.json({ ok: true, html: r.html, words: r.words, minutes: r.readingMinutes, toc: r.toc });
});

// ───────────── Categories ─────────────
router.get('/categories', (req, res) => res.admin('categories', { title: 'Categories', cats: db.all('SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) n FROM categories c ORDER BY sort') }));
router.post('/categories', (req, res) => {
  const b = req.body;
  const row = { name: String(b.name || '').slice(0, 80), slug: slugify(b.slug || b.name), description: String(b.description || '').slice(0, 300), hub: ['personal', 'residential', 'auto', 'commercial', 'claims'].includes(b.hub) ? b.hub : 'personal', sort: Number(b.sort) || 0 };
  if (!row.name) return res.redirect(303, '/admin/categories?_err=Name+required');
  if (b.id) db.update('categories', Number(b.id), row); else db.insert('categories', row);
  cache.clear();
  res.redirect(303, '/admin/categories?_ok=Saved');
});

// ───────────── Media library ─────────────
router.get('/media', (req, res) => {
  const adopted = req.query.adopt ? media.adoptOrphans() : 0;
  res.admin('media', { title: 'Media library', list: db.all('SELECT * FROM media ORDER BY id DESC'), adopted, refs: req.query.refs ? JSON.parse(req.query.refs) : null, refId: req.query.id });
});
router.post('/media', (req, res) => {
  upload.single('file')(req, res, (err) => {
    const wantsJson = (req.get('accept') || '').includes('application/json');
    const fail = (msg) => (wantsJson ? res.status(422).json({ ok: false, error: msg }) : res.redirect(303, `/admin/media?_err=${encodeURIComponent(msg)}`));
    if (err) return fail(err.code === 'LIMIT_FILE_SIZE' ? 'That file is over the 5 MB limit.' : 'Upload failed — please try again.');
    if (!req.file) return fail('Choose an image to upload.');
    try {
      const m = media.save(req.file.buffer, { originalName: req.file.originalname, alt: req.body.alt, userId: req.user.id });
      if (wantsJson) return res.json({ ok: true, ...m });
      res.redirect(303, `/admin/media?_ok=${encodeURIComponent('Uploaded ' + m.url)}`);
    } catch (e) { fail(e.message); }
  });
});
router.post('/media/:id/alt', (req, res) => {
  db.run('UPDATE media SET alt = ? WHERE id = ?', [String(req.body.alt || '').slice(0, 300), Number(req.params.id)]);
  res.redirect(303, '/admin/media?_ok=Alt+text+saved');
});
router.post('/media/:id/delete', (req, res) => {
  const r = media.remove(Number(req.params.id), { force: req.body.force === '1' });
  if (r.inUse) return res.redirect(303, `/admin/media?id=${req.params.id}&refs=${encodeURIComponent(JSON.stringify(r.refs))}&_err=${encodeURIComponent(`Still used in ${r.total} place(s) — confirm to delete anyway`)}`);
  res.redirect(303, `/admin/media?_ok=${r.ok ? 'Deleted' : encodeURIComponent(r.error)}`);
});

module.exports = router;
