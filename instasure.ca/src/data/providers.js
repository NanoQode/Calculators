'use strict';
/**
 * Default insurer logos (public/img/providers/), supplied by the owner on October 3, 2026 from the
 * Compulife logo packs and trimmed to the logo edge. They seed the Insurers & MGAs list (src/lib/partners.js)
 * until an admin saves their own list. Pixel sizes are read from the files so layout never drifts from the art.
 */
const fs = require('node:fs');
const path = require('node:path');
const { dimensions } = require('../lib/media');

const DIR = path.join(__dirname, '..', '..', 'public', 'img', 'providers');

// Display order: the order the home scroller and logo bands use.
const PROVIDERS = [
  ['canada-life', 'Canada Life'],
  ['manulife', 'Manulife'],
  ['ia-financial-group', 'iA Financial Group'],
  ['desjardins', 'Desjardins'],
  ['beneva', 'Beneva'],
  ['empire-life', 'Empire Life'],
  ['equitable', 'Equitable'],
  ['rbc-insurance', 'RBC Insurance'],
  ['bmo-insurance', 'BMO Insurance'],
  ['co-operators', 'Co-operators'],
  ['canada-protection-plan', 'Canada Protection Plan'],
  ['humania-assurance', 'Humania Assurance'],
  ['policyme', 'PolicyMe'],
  ['primerica', 'Primerica'],
  ['faithlife-financial', 'FaithLife Financial'],
  ['serenia-life-financial', 'Serenia Life Financial'],
  ['cumis', 'CUMIS'],
  ['blue-cross', 'Blue Cross'],
];

const providers = PROVIDERS.map(([slug, name], i) => {
  const file = path.join(DIR, `${slug}.webp`);
  const dim = fs.existsSync(file) ? dimensions(fs.readFileSync(file)) : null;
  return { id: slug, name, type: 'insurer', logo: dim ? `/img/providers/${slug}.webp` : '', w: dim && dim.w, h: dim && dim.h, lines: [], show: true, order: i + 1 };
});

module.exports = { providers };
