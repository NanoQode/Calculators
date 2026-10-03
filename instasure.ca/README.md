# instasure.ca

A Canada-wide insurance lead-generation site: instant answers, instant estimates and a licensed advisor for every province, built to rank in search and AI answer engines. It includes a lead-management backend with scoring, routing, drip email, SEO tooling, analytics and a blog/guide CMS with direct publishing.

- **Strategy:** [`docs/STRATEGY.md`](docs/STRATEGY.md) covers brand positioning, the competitor correlation map and niche gaps, page hierarchy, title and meta templates, the content and data plan, and the roadmap.
- **Keywords:** [`docs/KEYWORDS.md`](docs/KEYWORDS.md) lists city, provincial and Canada-wide keywords sorted by volume, each with its target page ([`keywords.csv`](docs/keywords.csv) has the same data).
- **Competitor site review:** [`docs/SITE_REVIEW.md`](docs/SITE_REVIEW.md) covers the direct crawl of competitor sitemaps, metadata and schema, and what changed as a result.
- **Before launch:** [`docs/CONTENT_REVIEW.md`](docs/CONTENT_REVIEW.md) lists licensing, trust claims, facts to verify and consent settings.

## Quick start

Requires **Node.js 22.5 or later** (it uses the built-in `node:sqlite`, so there is no database server to install).

```bash
cd instasure.ca
npm install
npm run build        # compile Tailwind CSS to public/assets/site.css
npm start            # http://localhost:3000, admin at /admin
```

On first start the app creates `data/instasure.db` and seeds:
- the admin user, from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, or with a random password printed once to the console;
- scoring rules, 7 drip campaigns, guide categories and 18 launch guides;
- 711 target keywords (re-running the seed maps stored keywords to pages built since, without overwriting admin edits);
- 4 **sample advisors**, flagged as demo and noindexed, each tagged with a few specialist desks so routing can be tried. Replace them before launch.

Copy `.env.example` to `.env` for production settings. `SESSION_SECRET`, `TRACKING_SECRET` and `SITE_URL` are required in production.

| Command | What it does |
|---|---|
| `npm run dev` | Build CSS, then run with `--watch` |
| `npm run watch:css` | Rebuild CSS on template changes |
| `npm run seed` | Run the idempotent seed (also runs on start) |
| `npm run seed -- --guides` | Re-import the Markdown guides in `src/content/guides/`, overwriting edits made in the admin |
| `npm run keywords:report` | Regenerate `docs/KEYWORDS.md` and `docs/keywords.csv` from `src/data/keywords.js` |
| `npm test` | Unit and integration tests (Node's test runner, temporary database) |

## Architecture

```
server.js                 entry: seed, Express app, drip scheduler
src/
  app.js                  middleware: helmet CSP with nonces, compression, canonical redirects, redirects/410s, page cache
  config.js               env settings (.env loader included)
  db/                     schema.sql, node:sqlite wrapper, idempotent seed
  data/                   products (18), services (45), provinces and cities (13 + 57), glossary, keyword map
  content/                Markdown trust pages and launch guides (JSON front matter)
  lib/                    quote-engine, scoring, routing, specialties (desks), leads, drip, mailer, seo, crawlers,
                          indexnow, publisher, tracking, media, pages, charts, auth
  routes/
    public.js             server-rendered pages
    api.js                quote/lead/newsletter/tracking JSON endpoints
    system.js             robots.txt, sitemaps, llms.txt, guide .md twins, email tracking, unsubscribe
    admin/                dashboard, leads, campaigns, content, SEO, analytics, site settings
views/public, views/admin EJS templates (design tokens from the Stitch mockups, mobile and desktop)
public/                   compiled CSS, JS (site, calculators, admin, SEO audit), SVG logo, uploads
```

### Public site

| Path | Purpose |
|---|---|
| `/` | Instant-quote portal |
| `/quote/`, `/quote/{product}/`, `/quote/results/{ref}/` | 60-second estimate flow, then results and advisor match |
| `/{product}/`, `/{product}/{province}/`, `/{product}/{province}/{city}/` | 18 product pillars, 234 province pages and 406 city pages. City pages without enough local content are noindexed until an editor enriches them. |
| `/insurance-services/` | All services hub: products, services and specialist desks |
| `/car-insurance/high-risk-drivers/`, `/pet-insurance/`, `/contractor-insurance/plumber/`… | 45 service pages for what competitors sell beyond the core products; 12 of them (plus condo, super visa and mortgage life) have a specialist desk with a call-back form |
| `/insurance/{province}/{city}/` | Province and city hubs |
| `/guides/…`, `/calculators/…`, `/compare/`, `/glossary/`, `/insights/rate-index/` | Knowledge, tools and data |
| `/advisors/{slug}/` | Licensed advisor profiles |
| `/about/`, `/how-we-make-money/`, `/licensing/`, `/editorial-guidelines/`, `/privacy/`, `/terms/`, `/accessibility/` | Trust pages |

That is 826 URLs, 654 of them indexable, with JSON-LD on every page type, split XML sitemaps (indexable pages only), robots.txt with an AI-crawler policy switch, `llms.txt`/`llms-full.txt`, Markdown twins of guides, and IndexNow on publish.

### Admin (`/admin`)

| Area | Features |
|---|---|
| **Dashboard** | Leads, grades, sources, pipeline value, hot leads, crawler activity |
| **Leads** | Inbox with filters, lead detail and timeline, notes, status pipeline (kanban), reassign, CSV export (formula-injection safe), anonymise/delete (PIPEDA, Law 25) |
| **Scoring** | Editable rules (fit, intent, engagement, data quality) to a 0–100 score and A–D grade; hot-lead alerts |
| **Routing** | Licensed advisors by province, product line and language, with capacity and weights. Specialist desks: tag advisors with the desks they staff; desk leads go to a desk specialist first, then to a licensed generalist (logged on the lead) |
| **Campaigns** | Drip sequences by trigger and filter, step editor with preview, CASL controls (express consent, quiet hours by province time zone, suppression, one-click unsubscribe), email log with opens and clicks |
| **Content** | Guide/blog editor with a live SEO and answer-engine audit, FAQ, takeaways, sources, reviewer, scheduling, direct publish (purges cache, updates sitemaps, pings IndexNow) |
| **SEO** | Per-URL overrides (title, description, robots, canonical, local intro), keyword map with CSV import/export, redirects and 410s, 404 monitor, indexation report, crawler log, IndexNow log |
| **Analytics** | First-party pageviews, sources (including AI referrers), landing pages, funnel, leads by product, province and grade |
| **Site** | Settings (company, customer service number and hours, trust claims, consent wording, serviceable provinces, AI bot policy, estimates-reviewed date), products, geo overrides, media library, users |

## Customer service number

The site ships with the placeholder **1-800-000-0000** (Admin → Site → Settings → Customer service number). It appears in the header, menus, footer, services hub, service pages and desk panels, but stays out of structured data until it is replaced, and the launch checklist on the dashboard flags it. Enter the real number and hours there; no code change is needed.

## Compliance built in

- **CASL:** unchecked consent boxes; express consent by default (implied consent optional); sender ID and mailing address in every email; one-click unsubscribe with `List-Unsubscribe` headers; suppression list; quiet hours.
- **Privacy (PIPEDA, Quebec Law 25):** a cookie banner; visitor and session cookies (and GA4 analytics storage, if configured) only after opt-in, with cookieless page counts otherwise; IP addresses stored only as keyed hashes; lead anonymise/delete; a privacy officer field.
- **Licensing:** leads route only to advisors licensed in the visitor's province. Non-serviceable provinces (Quebec and the territories by default) get a waitlist.
- **Advertising:** estimates always show the example profile and date; ratings, carrier names and licence numbers stay hidden until real values are entered.

See [`docs/CONTENT_REVIEW.md`](docs/CONTENT_REVIEW.md) for the full pre-launch checklist.

## Deployment notes

- Run behind a reverse proxy with TLS; set `TRUST_PROXY` to match.
- Back up `data/instasure.db` (SQLite in WAL mode) and `public/uploads/`.
- Run the drip scheduler on one instance only (`DRIP_DISABLED=true` on the others).
- Set `INDEXNOW_ENABLED=true` only in production.
