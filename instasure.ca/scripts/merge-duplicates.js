'use strict';
// CLI: npm run merge-duplicates            → list the duplicate groups that would be merged (no changes)
//      npm run merge-duplicates -- --apply → merge every group into its earliest lead
// One person = one lead. A group is the leads that share an email address, or a phone number with
// a compatible first name (a shared household number never joins two different people). Merging
// keeps the earliest record and its reference, fills its blank fields from the others, keeps every
// product asked about, moves timelines, emails, tasks and drip enrolments onto it, and keeps the
// merged references working (results pages, unsubscribe links). Admin → Leads → Duplicates does
// the same one group at a time.
require('../src/db').open();
const merge = require('../src/lib/merge');

const groups = merge.preview(100000);
if (!groups.length) { console.log('[merge-duplicates] no duplicates found'); process.exit(0); }
for (const g of groups) {
  const [keep, ...rest] = g.leads;
  console.log(`${keep.ref} ← ${rest.map((l) => l.ref).join(', ')}  (${keep.email}${keep.phone ? ', ' + keep.phone : ''})`);
}
const extra = groups.reduce((n, g) => n + g.ids.length - 1, 0);
if (!process.argv.includes('--apply')) {
  console.log(`[merge-duplicates] ${groups.length} groups, ${extra} leads would be merged. Run with --apply to merge.`);
  process.exit(0);
}
const r = merge.mergeAll();
console.log(`[merge-duplicates] merged ${r.merged} leads into ${r.groups}`);
