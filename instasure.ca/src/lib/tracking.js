'use strict';
/**
 * First-party analytics (no third-party scripts) + crawler intelligence.
 *  - Pageviews/events arrive from /js/site.js via navigator.sendBeacon → /api/t.
 *  - Visitor/session ids are first-party cookies only after consent (Quebec Law 25 friendly);
 *    without consent we still count anonymous pageviews.
 *  - Server-side middleware logs search & AI crawler fetches so the admin can see exactly which
 *    pages GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Googlebot, Bingbot… read.
 */
const db = require('../db');
const { classifySource } = require('./leads');

const BOTS = [
  // [regex, name, kind]
  [/GPTBot/i, 'GPTBot', 'ai_training'],
  [/OAI-SearchBot/i, 'OAI-SearchBot', 'ai_search'],
  [/ChatGPT-User/i, 'ChatGPT-User', 'ai_user'],
  [/ClaudeBot/i, 'ClaudeBot', 'ai_training'],
  [/Claude-SearchBot/i, 'Claude-SearchBot', 'ai_search'],
  [/Claude-User/i, 'Claude-User', 'ai_user'],
  [/anthropic-ai/i, 'anthropic-ai', 'ai_training'],
  [/PerplexityBot/i, 'PerplexityBot', 'ai_search'],
  [/Perplexity-User/i, 'Perplexity-User', 'ai_user'],
  [/Google-CloudVertexBot|GoogleOther/i, 'GoogleOther', 'ai_training'],
  [/Applebot-Extended/i, 'Applebot-Extended', 'ai_training'],
  [/CCBot/i, 'CCBot', 'ai_training'],
  [/Bytespider/i, 'Bytespider', 'ai_training'],
  [/Amazonbot/i, 'Amazonbot', 'ai_search'],
  [/meta-externalagent|meta-externalfetcher|FacebookBot/i, 'Meta AI', 'ai_training'],
  [/cohere-ai|cohere-training/i, 'Cohere', 'ai_training'],
  [/MistralAI-User/i, 'MistralAI-User', 'ai_user'],
  [/DuckAssistBot/i, 'DuckAssistBot', 'ai_search'],
  [/YouBot/i, 'YouBot', 'ai_search'],
  [/Googlebot/i, 'Googlebot', 'search'],
  [/bingbot/i, 'Bingbot', 'search'],
  [/Applebot/i, 'Applebot', 'search'],
  [/DuckDuckBot/i, 'DuckDuckBot', 'search'],
  [/YandexBot/i, 'YandexBot', 'search'],
  [/Baiduspider/i, 'Baiduspider', 'search'],
  [/AhrefsBot|SemrushBot|MJ12bot|DotBot|Screaming Frog|rogerbot|serpstatbot/i, 'SEO tool', 'seo'],
  [/bot|crawler|spider|crawling|headless|python-requests|curl\/|wget/i, 'Other bot', 'other'],
];

function detectBot(ua) {
  if (!ua) return null;
  for (const [re, name, kind] of BOTS) if (re.test(ua)) return { name, kind };
  return null;
}

function device(ua = '') {
  if (/iPad|Tablet|Nexus 7|SM-T/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Express middleware: log crawler hits on HTML/text routes (not assets). */
function crawlerLogger(req, res, next) {
  const bot = detectBot(req.get('user-agent'));
  if (!bot || req.method !== 'GET' || /^\/(assets|img|js|uploads|favicon)/.test(req.path)) return next();
  req.bot = bot;
  res.on('finish', () => {
    try { db.insert('crawler_hits', { bot: bot.name, kind: bot.kind, path: req.path.slice(0, 300), status: res.statusCode }); } catch { /* never break a response */ }
  });
  next();
}

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const EVENT_NAMES = new Set(['quote_start', 'quote_step', 'quote_complete', 'calculator_use', 'cta_click', 'phone_click', 'booking_click', 'search', 'faq_open', 'save_progress', 'scroll_75']);

/** Ingest one beacon payload. Returns true when stored. */
function ingest(body, req) {
  if (!body || typeof body !== 'object') return false;
  const ua = req.get('user-agent') || '';
  if (detectBot(ua)) return false;
  const visitor_id = ID_RE.test(body.v || '') ? body.v : null;
  const session_id = ID_RE.test(body.s || '') ? body.s : null;
  const path = String(body.p || '').slice(0, 300);
  if (!path.startsWith('/') || path.startsWith('/admin')) return false;
  if (body.t === 'pv') {
    const ref = String(body.r || '').slice(0, 300);
    let refHost = null;
    try { refHost = ref ? new URL(ref).hostname : null; } catch { refHost = null; }
    const utm = body.u && typeof body.u === 'object' ? body.u : {};
    db.insert('pageviews', {
      path, title: String(body.ti || '').slice(0, 200),
      referrer_host: refHost, source: classifySource({ referrer: ref, utm_medium: utm.medium }),
      utm_source: utm.source ? String(utm.source).slice(0, 80) : null,
      utm_medium: utm.medium ? String(utm.medium).slice(0, 80) : null,
      utm_campaign: utm.campaign ? String(utm.campaign).slice(0, 120) : null,
      visitor_id, session_id, device: device(ua), is_entry: body.e ? 1 : 0,
    });
    return true;
  }
  if (body.t === 'ev' && EVENT_NAMES.has(body.n)) {
    const data = body.d && typeof body.d === 'object' ? JSON.stringify(body.d).slice(0, 1000) : '{}';
    db.insert('events', { name: body.n, path, visitor_id, session_id, data });
    return true;
  }
  return false;
}

/** Fixed-window in-memory rate limiter. */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const k = req.ip;
    const n = (hits.get(k) || 0) + 1;
    hits.set(k, n);
    if (n > max) return res.status(429).json({ ok: false, error: 'Too many requests — please try again shortly.' });
    next();
  };
}

module.exports = { detectBot, device, crawlerLogger, ingest, rateLimit, BOTS };
