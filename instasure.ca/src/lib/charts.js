'use strict';
/**
 * Dependency-free, server-rendered charts for the admin (SVG + HTML).
 * Follows the dataviz method: single-series marks in the brand emerald, thin marks with 4px rounded
 * data-ends anchored to the baseline, 2px gaps, 2px lines, recessive grid, one y-axis, text in ink
 * tokens (never series colour), per-mark hover via <title> with hit targets larger than the mark,
 * and every chart paired with a table view in the template.
 */
const { escapeHtml, num } = require('./util');

const INK = '#0b1c30';
const INK2 = '#44474d';
const GRID = '#e5eeff';
const SERIES = '#006c46';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function roundedTopRect(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** Vertical bar chart for a time series (e.g. leads per day). */
function bars(items, { height = 180, width = 640, color = SERIES, format = num, label = 'Value' } = {}) {
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const max = niceMax(Math.max(0, ...items.map((d) => d.value)));
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const slot = items.length ? iw / items.length : iw;
  const bw = Math.max(2, slot - 2);
  const every = Math.ceil(items.length / 8);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    g += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="${INK2}">${escapeHtml(format((max * i) / 4))}</text>`;
  }
  items.forEach((d, i) => {
    const h = (d.value / max) * ih;
    const x = pad.l + i * slot + 1;
    const y = pad.t + ih - h;
    g += `<g><title>${escapeHtml(d.label)}: ${escapeHtml(format(d.value))} ${escapeHtml(label.toLowerCase())}</title>`;
    g += `<rect x="${x - 1}" y="${pad.t}" width="${slot}" height="${ih}" fill="transparent"/>`;
    g += `<path d="${roundedTopRect(x, y, bw, h)}" fill="${color}"/></g>`;
    if (i % every === 0) g += `<text x="${x + bw / 2}" y="${height - 6}" text-anchor="middle" font-size="10" fill="${INK2}">${escapeHtml(d.short || d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-auto" role="img" aria-label="${escapeHtml(label)} over time">${g}</svg>`;
}

/** Line chart (single series) with light area and hover hit columns. */
function line(items, { height = 180, width = 640, color = SERIES, format = num, label = 'Value' } = {}) {
  const pad = { l: 40, r: 10, t: 10, b: 22 };
  const max = niceMax(Math.max(0, ...items.map((d) => d.value)));
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const step = items.length > 1 ? iw / (items.length - 1) : iw;
  const X = (i) => pad.l + i * step;
  const Y = (v) => pad.t + ih - (v / max) * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    g += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}" stroke="${GRID}"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="${INK2}">${escapeHtml(format((max * i) / 4))}</text>`;
  }
  if (items.length) {
    const pts = items.map((d, i) => `${X(i).toFixed(1)},${Y(d.value).toFixed(1)}`);
    g += `<path d="M${pts[0]} L${pts.join(' L')} L${X(items.length - 1)},${pad.t + ih} L${X(0)},${pad.t + ih} Z" fill="${color}" opacity="0.08"/>`;
    g += `<path d="M${pts.join(' L')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const every = Math.ceil(items.length / 8);
    items.forEach((d, i) => {
      g += `<g><title>${escapeHtml(d.label)}: ${escapeHtml(format(d.value))} ${escapeHtml(label.toLowerCase())}</title><rect x="${X(i) - step / 2}" y="${pad.t}" width="${Math.max(step, 6)}" height="${ih}" fill="transparent"/><circle cx="${X(i)}" cy="${Y(d.value)}" r="${items.length <= 31 ? 3 : 0}" fill="${color}" stroke="#fff" stroke-width="2"/></g>`;
      if (i % every === 0) g += `<text x="${X(i)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="${INK2}">${escapeHtml(d.short || d.label)}</text>`;
    });
  }
  return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-auto" role="img" aria-label="${escapeHtml(label)} over time">${g}</svg>`;
}

/** Horizontal bars in HTML (best for long category labels). */
function hbars(items, { format = num, color = SERIES, suffix = '' } = {}) {
  const max = Math.max(1, ...items.map((d) => d.value));
  return `<div class="space-y-2">${items.map((d) => {
    const pct = Math.max(1.5, (d.value / max) * 100);
    return `<div title="${escapeHtml(d.label)}: ${escapeHtml(format(d.value))}${escapeHtml(suffix)}">
      <div class="flex justify-between gap-2 text-[12px] leading-4" style="color:${INK}"><span class="truncate">${escapeHtml(d.label)}</span><span class="tabular-nums" style="color:${INK2}">${escapeHtml(format(d.value))}${escapeHtml(suffix)}${d.extra ? ` · ${escapeHtml(d.extra)}` : ''}</span></div>
      <div class="h-2 rounded-full mt-1" style="background:${GRID}"><div class="h-2 rounded-full" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
    </div>`;
  }).join('')}</div>`;
}

/** Funnel: ordinal stages as horizontal bars with step conversion. */
function funnel(stages) {
  const top = Math.max(1, stages[0] ? stages[0].value : 1);
  const ramp = ['#0a1e33', '#36485f', '#006c46', '#007149', '#53de9e'];
  return `<div class="space-y-2">${stages.map((s, i) => {
    const pct = (s.value / top) * 100;
    const conv = i > 0 && stages[i - 1].value ? ` · ${((s.value / stages[i - 1].value) * 100).toFixed(1)}% of previous` : '';
    return `<div title="${escapeHtml(s.label)}: ${num(s.value)}${conv}"><div class="flex justify-between text-[12px]" style="color:${INK}"><span>${escapeHtml(s.label)}</span><span style="color:${INK2}">${num(s.value)}${escapeHtml(conv)}</span></div>
      <div class="h-3 rounded-full mt-1" style="background:${GRID}"><div class="h-3 rounded-full" style="width:${Math.max(1.5, pct).toFixed(1)}%;background:${ramp[Math.min(i, ramp.length - 1)]}"></div></div></div>`;
  }).join('')}</div>`;
}

module.exports = { bars, line, hbars, funnel, niceMax };
