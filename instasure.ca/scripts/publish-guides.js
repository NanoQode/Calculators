'use strict';
// CLI: npm run guides:publish -- [--dir <folder>] [--update] [slug …]
// Publishes guide files (JSON front matter + Markdown, see docs/BLOG_PUBLISHING.md) whose slug is not in the
// database yet: renders, scores, stamps today's date, purges the cache and pings IndexNow. Existing guides are
// skipped unless --update is given (then only the slugs listed). Default folder: src/content/guides.
// On the server this runs from /usr/local/sbin/instasure-content-sync after each push to the content branch.
const path = require('node:path');
require('../src/db').open();
const { publishGuideFiles } = require('../src/db/seed');

const args = process.argv.slice(2);
const at = args.indexOf('--dir');
const dir = at > -1 ? path.resolve(args[at + 1]) : path.join(__dirname, '..', 'src', 'content', 'guides');
const update = args.includes('--update');
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--dir');
if (update && !only.length) { console.error('--update needs the slugs to overwrite'); process.exit(2); }

publishGuideFiles(dir, { update, only: only.length ? only : null })
  .then((out) => { console.log(JSON.stringify({ published: out.length, guides: out })); })
  .catch((e) => { console.error('[guides:publish]', e.message); process.exitCode = 1; });
