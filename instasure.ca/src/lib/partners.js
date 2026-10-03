'use strict';
/**
 * Insurers and MGAs (managing general agencies) the advisors are appointed with, with their logos.
 *
 * Stored as the `partners` setting: [{ id, name, type: 'insurer'|'mga', logo, w, h, lines: [category…], show, order }].
 * Logos go through the media store (src/lib/media.js), so they are sniffed images with generated names; SVG is refused.
 *
 * Nothing shows on the public site until `carriers_confirmed` is on: an admin confirms written appointments
 * with every listed insurer or MGA and permission to use each logo (advertising rules, Competition Act, trademarks).
 * Before the first save, the list comes from the older `carriers` setting (names only, insurers).
 */
const settings = require('./settings');
const { CATEGORIES } = require('../data/products');

const TYPES = { insurer: 'Insurer', mga: 'MGA (managing general agency)' };

function normalise(p, i) {
  return {
    id: String(p.id || `p${i + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || `p${i + 1}`,
    name: String(p.name || '').trim().slice(0, 80),
    type: TYPES[p.type] ? p.type : 'insurer',
    logo: /^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(p.logo || '') ? p.logo : '',
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
  const raw = Array.isArray(stored) ? stored : (settings.get('carriers') || []).map((name, i) => ({ id: `p${i + 1}`, name, type: 'insurer' }));
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

module.exports = { TYPES, list, save, nextId, visible, normalise };
