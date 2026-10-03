'use strict';
// CLI: npm run indexnow:submit → submit every indexable URL (and the sitemaps) to IndexNow
// (Bing, which also feeds ChatGPT search and Copilot, plus Yandex, Seznam and Naver).
// Google does not use IndexNow: submit /sitemap.xml in Search Console instead.
// Needs INDEXNOW_ENABLED=true and the running site serving /{indexnow_key}.txt.
require('../src/db').open();
const pages = require('../src/lib/pages');
const crawlers = require('../src/lib/crawlers');
const indexnow = require('../src/lib/indexnow');

(async () => {
  const live = pages.allPages().filter((p) => p.indexable);
  const urls = live.map((p) => p.path);
  const maps = ['/sitemap.xml', ...Object.keys(crawlers.GROUPS).filter((g) => live.some(crawlers.GROUPS[g])).map((g) => `/sitemap-${g}.xml`)];
  const res = await indexnow.ping([...urls, ...maps]);
  console.log(`[indexnow] ${urls.length} pages + ${maps.length} sitemaps →`, JSON.stringify(res));
  if (res.status && res.status >= 300) process.exitCode = 1;
})();
