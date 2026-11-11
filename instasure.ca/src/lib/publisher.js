'use strict';
/**
 * Direct-publish pipeline for guides: render markdown → HTML/TOC, compute SEO score, stamp
 * dates, snapshot a revision, purge the page cache and ping IndexNow — so a post is live,
 * in the sitemap, in llms.txt and announced to search engines within seconds of "Publish".
 */
const db = require('../db');
const md = require('./markdown');
const cache = require('./cache');
const indexnow = require('./indexnow');
const config = require('../config');
const { audit } = require('../../public/js/seo-audit');
const { sqlNow } = require('./util');

function compile(post) {
  const r = md.render(post.body_md);
  const a = audit({
    title: post.title, seoTitle: post.seo_title, metaDescription: post.meta_description, slug: post.slug,
    bodyMd: post.body_md, focusKeyword: post.focus_keyword, excerpt: post.excerpt,
    faq: db.json(post.faq, []), takeaways: db.json(post.takeaways, []), sources: db.json(post.sources, []),
    featuredImage: post.featured_image, imageAlt: post.image_alt, products: db.json(post.products, []),
    contentType: post.content_type, siteHost: new URL(config.siteUrl).host,
  });
  return { body_html: r.html, toc: r.toc, word_count: r.words, reading_minutes: r.readingMinutes, seo_score: a.score };
}

/** Recompile a post's derived fields (used on every save). */
function recompile(id) {
  const post = db.get('SELECT * FROM posts WHERE id = ?', [id]);
  if (!post) return null;
  const c = compile(post);
  db.update('posts', id, c);
  return { ...post, ...c };
}

function snapshot(post, userId) {
  db.insert('post_revisions', { post_id: post.id, title: post.title, body_md: post.body_md, meta: { seo_title: post.seo_title, meta_description: post.meta_description, status: post.status }, user_id: userId || null });
}

async function publish(id, { userId } = {}) {
  const post = recompile(id);
  if (!post) throw new Error('Post not found');
  const now = sqlNow();
  db.update('posts', id, { status: 'published', published_at: post.published_at || now, updated_at: now, scheduled_at: null });
  snapshot(post, userId);
  cache.clear();
  const ping = await indexnow.ping([`/guides/${post.slug}/`, '/guides/', '/sitemap-guides.xml']);
  db.insert('audit_log', { user_id: userId || null, action: 'publish', entity: 'post', entity_id: String(id), data: { slug: post.slug, indexnow: ping } });
  return { post: db.get('SELECT * FROM posts WHERE id = ?', [id]), ping };
}

function publishDue() {
  const due = db.all("SELECT id FROM posts WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?", [sqlNow()]);
  for (const p of due) publish(p.id).catch((e) => console.error('[publisher] scheduled publish failed', p.id, e));
  return due.length;
}

module.exports = { compile, recompile, publish, publishDue, snapshot };
