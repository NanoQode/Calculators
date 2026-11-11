'use strict';
// CLI: npm run team-advisor            → create or update the "Instasure Advisor Team" avatar profile
//      npm run team-advisor -- --off   → deactivate it (do this once real licensed advisors are loaded)
// The team profile receives every lead that has no individual advisor, alerts the first "notify
// emails" address, and is shown with a brand avatar. It has no licence on record, so it is not
// indexed or marked up as a Person (pages.advisorListed).
require('../src/db').open();
const db = require('../src/db');
const settings = require('../src/lib/settings');
const { CATEGORIES } = require('../src/data/products');
const { sqlNow } = require('../src/lib/util');

const SLUG = 'instasure-advisor-team';
const s = settings.all();
const row = {
  name: 'Instasure Advisor Team',
  title: 'Licensed advisor team',
  designations: null,
  photo: '/img/advisor-avatar.svg',
  email: (s.notify_emails || [])[0] || s.email || null,
  bio_md: [
    'The Instasure advisor team reviews every request you send us: instant estimates, specialist-desk call-backs and questions.',
    '',
    'We connect you with an insurance professional licensed in your province for the product you need, who compares insurers for you. There is no cost and no obligation to buy.',
  ].join('\n'),
  languages: ['en'],
  provinces: s.serviceable_provinces || [],
  categories: Object.keys(CATEGORIES),
  specialties: [],
  licences: [],
  active: process.argv.includes('--off') ? 0 : 1,
  accepting_leads: process.argv.includes('--off') ? 0 : 1,
  weight: 1,
  max_open_leads: null,
  is_demo: 0,
  updated_at: sqlNow(),
};
const have = db.get('SELECT id FROM advisors WHERE slug = ?', [SLUG]);
if (have) db.update('advisors', have.id, row); else db.insert('advisors', { ...row, slug: SLUG });
const a = db.get('SELECT id, name, active, email, provinces, categories FROM advisors WHERE slug = ?', [SLUG]);
console.log(`[team-advisor] ${have ? 'updated' : 'created'}:`, JSON.stringify(a));
