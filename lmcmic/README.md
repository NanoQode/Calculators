# lmcmic.ca — Lendmax Capital MIC investor site

A static, SEO-first investor site for Lendmax Capital Mortgage Investment
Corporation, built from the four supplied page designs and the
*Canadian Mortgage Investor SEO Content Roadmap* workbook.

```
content/data/seo-content-roadmap.xlsx   the workbook (Tab 1 keywords, Tab 2 article plan, Tab 3 checklist)
content/data/design-*.html              the four supplied page designs
content/plan.json                       Tab 2 + Tab 1 as data (python3 build/gen_plan.py)
content/WRITING-BRIEF.md                Tab 3 condensed into the rules every article follows
content/articles/<id>.md                the 90 planned articles (front matter + Markdown)
site.config.json                        facts used on more than one page — edit here, rebuild
templates/                              Jinja2 page templates (from the designs)
src/site.css, src/tailwind.config.js    design tokens from the designs, compiled at build time
src/site.js                             menu, tabs, calculators, video facade, lead form
server/lead-server.mjs                  POST /api/lead → store → email deals@ → redirect
deploy/                                 nginx vhost, systemd unit, installer, cert watcher
reports/                                content checklist (QA gate) + keyword coverage, per build
```

## Build

```
pip install -r requirements.txt && npm install
npm run build          # python3 build/build.py && tailwind → dist/
python3 build/qa.py    # Tab 3 section K automated checks on every article
```

`dist/` is the whole site: pages, `sitemap.xml` (with the video entry),
`robots.txt`, `llms.txt`, `site.webmanifest`, icons and per-page share images.

## SEO built in

* One canonical origin, `https://lmcmic.ca`, trailing-slash URLs. nginx 301s
  `http://`, `www.`, `/index.html` and the old WordPress/funnel paths to it in
  one hop; every page carries a self-referencing `rel=canonical` and `hreflang en-ca`.
* Unique `<title>` and meta description per page from the workbook's primary
  keyword; Open Graph / Twitter cards with a generated 1200×630 image per page.
* Structured data matching visible content only: Organization/FinancialService,
  WebSite, BreadcrumbList, Article, FAQPage, VideoObject, HowTo, DefinedTermSet,
  WebApplication (calculators), CollectionPage.
* Answer-engine format: a 40–90-word short answer at the top of every guide,
  question-led H2s, key takeaways, FAQs, sources, author and "current as of" date.
* Internal-link plan from Tab 2 resolved to URLs in both directions.
* Performance: compiled Tailwind (no CDN script), icon font subset to the glyphs
  used, YouTube loaded only on click, no layout shift from icons.

## Lead flow

Every form posts to `/api/lead`. The endpoint appends the enquiry to
`/var/lib/lmcmic/leads.jsonl` first, emails all fields (name, email, phone,
province, investor type, allocation, contact method, **best time and days to
contact, time zone**, message, consent, page, referrer, UTM/click IDs) to
`deals@lendmaxcapital.ca`, and returns the redirect to
`https://app.lendmaxcapital.ca/investor-start`. Failed sends are retried from
an outbox for 24 hours.

Outbound SMTP is blocked on the host, so email goes over HTTPS: set
`RESEND_API_KEY`, `POSTMARK_TOKEN` or `SENDGRID_API_KEY` in
`/etc/lmcmic/leads.env`; without one it relays through formsubmit.co, which
needs a one-time "Activate form" click in the deals@ inbox.

## Deploy

`dist/` is committed so the server deploys without building. Push, then on the server:

```
curl -fsSL https://raw.githubusercontent.com/nanoqode/calculators/ccr-ecad3a6a-7fqler/lmcmic/deploy/pull-deploy.sh | sudo bash
```

`pull-deploy.sh` downloads the branch, and `install.sh` creates a timestamped
release under `/var/www/lmcmic.ca/releases/`, flips the `current` symlink,
(re)starts `lmcmic-leads`, installs the nginx vhost on first run, and installs
the certificate watcher. Roll back with
`ln -sfn /var/www/lmcmic.ca/releases/<previous> /var/www/lmcmic.ca/current`.

Then point DNS at the server (Cloudflare: `A lmcmic.ca → 159.203.33.160`,
`CNAME www → lmcmic.ca`). The cert watcher (`/usr/local/sbin/lmcmic-cert`, cron
every 5 min) issues the Let's Encrypt certificate and enables HSTS as soon as
the domain reaches the server. Submit `https://lmcmic.ca/sitemap.xml` in Google
Search Console and Bing Webmaster Tools.
