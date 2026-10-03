'use strict';
/**
 * Insurers and MGAs (managing general agencies) the advisors are appointed with, with their logos.
 *
 * Stored as the `partners` setting: [{ id, name, type: 'insurer'|'mga', logo, w, h, lines: [category…], show, order }].
 * Logos go through the media store (src/lib/media.js), so they are sniffed images with generated names; SVG is refused.
 *
 * The logo bands that say advisors are appointed with these companies (product and service pages, the quote
 * sidebar, the footer) show only when `carriers_confirmed` is on: an admin confirms written appointments with every
 * listed insurer or MGA and permission to use each logo (advertising rules, Competition Act, trademarks).
 * The home page scroller ("Access Canada's Insurance Provider Network") follows its own switch, `provider_scroller`,
 * which the owner turned on for the supplied logos; its copy makes no appointment claim.
 * Before the first save, the list is the supplied set in src/data/providers.js.
 */
const settings = require('./settings');
const { CATEGORIES } = require('../data/products');
const { providers } = require('../data/providers');

const LOGO_RE = /^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp|gif)$|^\/img\/providers\/[a-z0-9-]+\.(png|webp)$/;

const TYPES = { insurer: 'Insurer', mga: 'MGA (managing general agency)' };

function normalise(p, i) {
  return {
    id: String(p.id || `p${i + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || `p${i + 1}`,
    name: String(p.name || '').trim().slice(0, 80),
    type: TYPES[p.type] ? p.type : 'insurer',
    logo: LOGO_RE.test(p.logo || '') ? p.logo : '',
    w: Number(p.w) > 0 ? Math.round(Number(p.w)) : null,
    h: Number(p.h) > 0 ? Math.round(Number(p.h)) : null,
    lines: (Array.isArray(p.lines) ? p.lines : []).filter((c) => CATEGORIES[c]),
    show: p.show !== false,
    order: Number.isFinite(Number(p.order)) ? Number(p.order) : i + 1,
  };
}

/** Every partner, in display order (admin view). */
function list() {
  const stored = settings.get('partners');
  const raw = Array.isArray(stored) ? stored : providers;
  return raw.map(normalise).filter((p) => p.name).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function save(rows) {
  settings.set('partners', rows.map(normalise).filter((p) => p.name));
}

function nextId(rows) {
  let n = rows.length + 1;
  while (rows.some((p) => p.id === `p${n}`)) n++;
  return `p${n}`;
}

/** What the public site may show: nothing until confirmed; optionally only partners for one product category. */
function visible(category) {
  if (!settings.get('carriers_confirmed')) return [];
  return list().filter((p) => p.show && (!category || !p.lines.length || p.lines.includes(category)));
}

/** Logos for the home page scroller: every shown partner that has a logo, unless the scroller is switched off. */
function scroller() {
  if (settings.get('provider_scroller') === false) return [];
  return list().filter((p) => p.show && p.logo && p.w && p.h);
}

/**
 * Display size for a logo so different shapes look equally weighted: every logo gets about the same area,
 * then height and width are capped so very wide or very square marks stay in line.
 */
function fit(p, { area = 5200, minH = 28, maxH = 58, maxW = 190 } = {}) {
  const ratio = p.w && p.h ? p.w / p.h : 3;
  let h = Math.sqrt(area / ratio);
  h = Math.min(maxH, Math.max(minH, h));
  let w = h * ratio;
  if (w > maxW) { w = maxW; h = w / ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

module.exports = { TYPES, list, save, nextId, visible, scroller, fit, normalise };
