'use strict';
// CLI: npm run seed            → idempotent seed
//      npm run seed -- --guides → re-import guides from src/content/guides (overwrites matching slugs)
const { seed, importGuides } = require('../src/db/seed');
seed();
if (process.argv.includes('--guides')) console.log(`[seed] ${importGuides({ force: true })} guides re-imported`);
