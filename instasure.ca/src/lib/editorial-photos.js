'use strict';
// Explicit page/slot mapping from the approved image workbook. No generated route guesses.
// The plan and the photos are server-managed (written on the server, carried forward by each deploy,
// not stored in git). Without the plan, pages render without editorial photos.
let plan = {};
try { plan = require('../data/editorial-photos.json'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const { escapeHtml: esc } = require('./util');
const staff = new Set(['IMG-008', 'IMG-155', 'IMG-156', 'IMG-159']);
function has(page, slot) { return Boolean(plan[page] && plan[page][slot]); }
function hasPlan(page) { return Object.hasOwn(plan, page); }
function render(page, slot, options = {}) {
  const im = plan[page] && plan[page][slot];
  if (!im) return '';
  const src = '/img/photos/' + im.file;
  const widths = [480, 800, 1200, 1600].filter(w => w <= im.width);
  const srcset = widths.map(w => `${src.replace(/\.jpeg$/, '')}-${w}.webp ${w}w`).join(', ');
  const sizes = options.wide ? '(min-width: 1024px) 760px, calc(100vw - 48px)' : '(min-width: 1280px) 580px, (min-width: 1024px) 48vw, calc(100vw - 48px)';
  const caption = staff.has(im.id) ? 'AI-generated illustration; not a photograph of the Instasure team.' : im.theme === 'Place' ? 'AI-generated illustration of the local setting.' : '';
  return `<figure class="editorial-photo" data-plan-image="${esc(im.id)}" data-photo-slot="${slot}"><picture><source type="image/webp" srcset="${esc(srcset)}" sizes="${sizes}"><img src="${esc(src)}" alt="${esc(im.alt)}" width="${im.width}" height="${im.height}" loading="${options.eager ? 'eager' : 'lazy'}" decoding="async"></picture>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}
function guideBody(page, html) {
  const im = plan[page] && plan[page][2];
  if (!im || !im.beforeHeading) return html;
  const token = `<h2 id="${im.beforeHeading}"`;
  return html.replace(token, render(page, 2, { wide: true }) + token);
}
function staticParts(page, html) {
  if (!has(page, 1)) return { intro: '', rest: html };
  // Keep all prose; wrap only the first heading/paragraph for the header image.
  const end = html.indexOf('</p>');
  if (end < 0) return { intro: '', rest: html };
  const intro = html.slice(0, end + 4);
  let rest = html.slice(end + 4);
  if (has(page, 2)) {
    const token = '<h2 id="who-we-are">';
    const at = rest.indexOf(token);
    const firstHeading = rest.indexOf('<h2');
    if (at >= 0 && firstHeading >= 0) rest = '<div class="photo-about-body"><div class="photo-about-first">' + rest.slice(0, firstHeading) + '</div>' + render(page, 2) + '<div class="photo-about-middle">' + rest.slice(firstHeading, at) + '</div><div class="photo-about-who">' + rest.slice(at) + '</div></div>';
  }
  return { intro, rest };
}
function thumbnail(page, post, classes) {
  const im = plan[page] && plan[page][1];
  if (im) {
    const base = '/img/photos/' + im.file.replace(/\.jpeg$/, '');
    const widths = [480, 800, 1200].filter(w => w <= im.width);
    const set = widths.map(w => `${base}-${w}.webp ${w}w`).join(', ');
    return `<img src="${esc(base)}-480.webp" srcset="${esc(set)}" sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, calc(100vw - 48px)" alt="${esc(im.alt)}" class="${esc(classes)}" loading="lazy" decoding="async" width="${im.width}" height="${im.height}">`;
  }
  if (!post.featured_image) return '';
  return `<img src="${esc(post.featured_image)}" alt="${esc(post.image_alt || '')}" class="${esc(classes)}" loading="lazy" decoding="async" width="400" height="225">`;
}
module.exports = { has, hasPlan, render, guideBody, staticParts, thumbnail };
