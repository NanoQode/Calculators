'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./config');
const db = require('./db');
const settings = require('./lib/settings');
const auth = require('./lib/auth');
const cache = require('./lib/cache');
const icons = require('./lib/icons');
const tracking = require('./lib/tracking');
const U = require('./lib/util');
const { CATEGORIES } = require('./data/products');

function assetVersion() {
  try {
    const css = fs.readFileSync(path.join(config.ROOT, 'public', 'assets', 'site.css'));
    const js = fs.readFileSync(path.join(config.ROOT, 'public', 'js', 'site.js'));
    return crypto.createHash('sha1').update(css).update(js).digest('hex').slice(0, 10);
  } catch { return String(Date.now()); }
}

let redirectsCache = null;
function redirects() {
  if (!redirectsCache) redirectsCache = new Map(db.all('SELECT from_path, to_path, code FROM redirects').map((r) => [r.from_path, r]));
  return redirectsCache;
}
function invalidateRedirects() { redirectsCache = null; }

function createApp() {
  db.open();
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.ROOT, 'views'));
  app.disable('x-powered-by');
  if (config.isProd) app.set('view cache', true);

  const version = assetVersion();
  const fontUrl = icons.fontUrl();

  app.use(compression());
  app.use((req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });
  app.use((req, res, next) => {
    const ga = settings.get('ga4_id');
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", `'nonce-${res.locals.nonce}'`, ...(ga ? ['https://www.googletagmanager.com'] : [])],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", ...(ga ? ['https://*.google-analytics.com', 'https://*.analytics.google.com'] : [])],
          'frame-src': ["'self'", 'https://calendly.com', 'https://cal.com', 'https://outlook.office365.com'],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })(req, res, next);
  });
  app.use(cookieParser());

  // Static assets: long-lived caching (cache-busted with ?v=version in templates).
  const staticOpts = { maxAge: config.isProd ? '365d' : 0, immutable: config.isProd, index: false };
  app.use('/assets', express.static(path.join(config.ROOT, 'public', 'assets'), staticOpts));
  app.use('/js', express.static(path.join(config.ROOT, 'public', 'js'), staticOpts));
  app.use('/img', express.static(path.join(config.ROOT, 'public', 'img'), { ...staticOpts, maxAge: config.isProd ? '30d' : 0, immutable: false }));
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: config.isProd ? '30d' : 0, index: false }));
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'));
  app.get('/favicon.svg', (req, res) => res.type('image/svg+xml').set('Cache-Control', 'public, max-age=604800').sendFile(path.join(config.ROOT, 'public', 'favicon.svg')));

  app.use(tracking.crawlerLogger);

  // Canonical URL hygiene + admin-managed redirects (before routing).
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const r = redirects().get(req.path) || redirects().get(req.path.replace(/\/$/, '')) || redirects().get(req.path + '/');
    if (r) {
      db.run('UPDATE redirects SET hits = hits + 1, last_hit_at = CURRENT_TIMESTAMP WHERE from_path = ?', [r.from_path]);
      if (r.code === 410) return res.status(410).set('X-Robots-Tag', 'noindex').type('html').send('<!doctype html><meta charset="utf-8"><title>Gone</title><p>This page has been permanently removed. <a href="/">Go to Instasure.ca</a></p>');
      return res.redirect(r.code, r.to_path + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    }
    const p = req.path;
    if (/^\/(api|admin|e|assets|js|img|uploads)\b/.test(p) || /\.[a-z0-9]{2,5}$/i.test(p) || p === '/unsubscribe') return next();
    let canon = (p.startsWith('/quote/results/') ? p : p.toLowerCase()).replace(/\/{2,}/g, '/');
    if (!canon.endsWith('/')) canon += '/';
    if (canon !== p) return res.redirect(301, canon + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    next();
  });

  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(auth.loadSession);

  // Shared view locals.
  app.use((req, res, next) => {
    const s = settings.all();
    res.locals.s = s;
    res.locals.U = U;
    res.locals.config = { siteUrl: config.siteUrl, isProd: config.isProd };
    res.locals.v = version;
    res.locals.fontUrl = fontUrl;
    res.locals.user = req.user || null;
    res.locals.csrf = req.session ? req.session.csrf : '';
    res.locals.currentPath = req.path;
    res.locals.CATEGORIES = CATEGORIES;
    res.locals.geoData = require('./data/geo');
    res.locals.mdlib = require('./lib/markdown');
    res.locals.phoneIsPlaceholder = settings.phoneIsPlaceholder;
    res.locals.tel = (n) => String(n || '').replace(/[^0-9+]/g, '');
    // Lowercase a product name for use mid-sentence, keeping proper nouns and acronyms intact.
    res.locals.lc = (t) => String(t || '').toLowerCase()
      .replace(/super visa/g, 'Super Visa').replace(/\be&o\b/g, 'E&O').replace(/\bd&o\b/g, 'D&O')
      .replace(/\b(canada|ontario|airbnb)\b/g, (w) => w[0].toUpperCase() + w.slice(1))
      .replace(/\b(rv|hvac|atv)\b/g, (w) => w.toUpperCase());
    res.locals.serviceData = require('./data/services');
    res.locals.desks = require('./lib/specialties').DESKS;
    res.locals.year = new Date().getFullYear();
    res.locals.flash = req.query._ok ? { type: 'ok', msg: String(req.query._ok).slice(0, 200) } : req.query._err ? { type: 'err', msg: String(req.query._err).slice(0, 200) } : null;
    /** Render a view inside a layout; caches anonymous public GETs. */
    res.page = (view, data = {}) => {
      const layout = data.layout || 'public';
      const locals = { ...res.locals, ...data };
      app.render(view, locals, (err, body) => {
        if (err) return next(err);
        app.render(`${layout}/layout`, { ...locals, body }, (err2, html) => {
          if (err2) return next(err2);
          if (data.status) res.status(data.status);
          if (layout === 'public' && !req.user && req.method === 'GET' && !data.noCache && (!data.status || data.status === 200)) {
            cache.set(req.originalUrl, html);
            res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
          }
          if (data.meta && data.meta.isNoindex) res.set('X-Robots-Tag', 'noindex, follow');
          res.type('html').send(html);
        });
      });
    };
    next();
  });

  // Serve cached public pages for anonymous visitors.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.user || /^\/(admin|api|e)\b/.test(req.path)) return next();
    const hit = cache.get(req.originalUrl);
    if (!hit) return next();
    res.set('X-Cache', 'HIT').type('html').send(hit.body);
  });

  app.use(require('./routes/system'));
  app.use('/api', require('./routes/api'));
  app.use('/admin', require('./routes/admin'));
  app.use(require('./routes/public'));

  // 404 with monitoring (feeds Admin → SEO → 404 monitor).
  app.use((req, res) => {
    if (req.method === 'GET' && !/^\/(api|admin|e)\b/.test(req.path) && !req.bot) {
      try {
        db.run(`INSERT INTO not_found(path, hits, referrer, last_seen_at) VALUES(?, 1, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(path) DO UPDATE SET hits = hits + 1, referrer = excluded.referrer, last_seen_at = CURRENT_TIMESTAMP`, [req.path.slice(0, 300), String(req.get('referer') || '').slice(0, 300)]);
      } catch { /* ignore */ }
    }
    if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
    const seo = require('./lib/seo');
    res.page('public/404', { status: 404, noCache: true, meta: seo.meta({ path: req.path, title: 'Page not found', description: 'The page you were looking for could not be found.', robots: 'noindex,follow' }) });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
    if (req.path.startsWith('/api/') || req.xhr) return res.status(status).json({ ok: false, error: status >= 500 ? 'Something went wrong.' : err.message, field: err.field });
    res.status(status).type('html').send(`<!doctype html><meta charset="utf-8"><title>Error</title><body style="font-family:system-ui;padding:40px"><h1>${status === 404 ? 'Not found' : 'Something went wrong'}</h1><p>${U.escapeHtml(status >= 500 ? 'Please try again in a moment.' : err.message)}</p><p><a href="/">Back to Instasure.ca</a></p>`);
  });

  return app;
}

module.exports = { createApp, invalidateRedirects };
