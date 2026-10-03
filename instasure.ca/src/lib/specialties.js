'use strict';
/**
 * Specialist desks: the niche-gap services (src/data/services.js, niche: true) and niche-gap products
 * (src/data/products.js, niche: true). Advisors staff desks through advisors.specialties; leads carry the
 * desk slug in leads.service, and routing tries a specialist first.
 */
const { services, bySlug: serviceBySlug } = require('../data/services');
const { products, bySlug: productBySlug } = require('../data/products');

/** Every desk: { slug, name, desk, pitch, kind, product, path, provinces } */
const DESKS = [
  ...products.filter((p) => p.niche).map((p) => ({ slug: p.slug, name: p.name, desk: p.desk, pitch: p.deskPitch, kind: 'product', product: p.slug, path: `/${p.slug}/`, provinces: null })),
  ...services.filter((s) => s.niche).map((s) => ({ slug: s.slug, name: s.name, desk: s.desk, pitch: s.deskPitch, kind: 'service', product: s.parent, path: s.path, provinces: s.provinces || null })),
];
const deskBySlug = Object.fromEntries(DESKS.map((d) => [d.slug, d]));

/** A valid `service` value on a lead: any service slug or any desk slug. */
function isService(slug) { return !!(serviceBySlug[slug] || deskBySlug[slug]); }
/** The product a service quotes and routes through. */
function productFor(slug) { return serviceBySlug[slug] ? serviceBySlug[slug].parent : deskBySlug[slug] ? deskBySlug[slug].product : null; }
function labelFor(slug) { return (serviceBySlug[slug] && serviceBySlug[slug].name) || (deskBySlug[slug] && deskBySlug[slug].name) || (productBySlug[slug] && productBySlug[slug].name) || slug; }

module.exports = { DESKS, deskBySlug, isService, productFor, labelFor };
