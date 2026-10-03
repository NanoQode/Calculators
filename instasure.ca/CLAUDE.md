# instasure.ca: project memory

Canada-wide insurance lead-generation site: instant answers, instant estimates and a licensed advisor in the visitor's province, with specialist desks for hard-to-place needs. Brand promise: instant information, instant quotes, someday instant policies. The research below drives all SEO and content work: **build pages and blog posts from the keywords and topics identified here, not from scratch.**

Last updated: October 3, 2026.

## Where everything is

| What | Where |
|---|---|
| Strategy: positioning, competitor correlation map, niche gaps, page hierarchy, title/meta templates, content plan, roadmap | [docs/STRATEGY.md](docs/STRATEGY.md) (imported below) |
| Direct crawl of competitor sites: sitemaps, metadata, schema, what changed as a result | [docs/SITE_REVIEW.md](docs/SITE_REVIEW.md) (imported below) |
| Pre-launch facts to verify, licensing and advertising rules | [docs/CONTENT_REVIEW.md](docs/CONTENT_REVIEW.md) (imported below) |
| **SEO workbook**: every page (title, meta, H1, primary keyword, sitemap file), page→keyword map, Nationwide / Provincial / City keyword tabs, backlog, segment summary, and the **Blog Content Plan** (last tab: 510 planned topics, 78 priority 1, plus the 18 published guides) | [docs/instasure-seo-keyword-content-plan.xlsx](docs/instasure-seo-keyword-content-plan.xlsx) |
| Blog Content Plan as CSV (same rows, greppable: title, URL, focus/secondary keywords, meta title/description, H2 outline, FAQ, value asset, internal links, CTA, schema, competitor gap, optimization, compliance, priority) | [docs/blog-content-plan.csv](docs/blog-content-plan.csv) |
| Full keyword map (711 rows, sorted by volume, with target page) | [docs/KEYWORDS.md](docs/KEYWORDS.md), [docs/keywords.csv](docs/keywords.csv); source of truth `src/data/keywords.js` (regenerate with `npm run keywords:report`) |
| Raw competitor research notes (topics competitors publish, SERP captures, AI-search and compliance notes) | [docs/research/](docs/research/) |
| Service catalogue (45 service pages, desks, FAQs) | `src/data/services.js`; products in `src/data/products.js`; desks in `src/lib/specialties.js` |

Read the workbook with pandas/openpyxl (`pd.read_excel(path, sheet_name=None)`) when you need the keyword or blog-plan rows; don't paste it whole into context.

## Research results in brief

- **Competitors studied (October 2026):** Ratehub, Rates.ca, PolicyAdvisor, Sun Life, Manulife, Sonnet. Ratehub, PolicyAdvisor and Sonnet were crawled directly (complete sitemaps). Rates.ca, Sun Life and Manulife return 403 to automated requests; their coverage came from search results and Rates.ca's llms.txt. Do not try to bypass their bot protection.
- **Keyword map:** 711 keywords: 157 Nationwide, 136 Provincial, 418 City; ~765,600 modelled searches/month. 667 point at a live page; 44 are backlog (mostly French Quebec, planned pages, insurer reviews and head-to-heads). 104 are priority 1. **Volumes are modelled estimates, not measured**: use them to order work, and replace them with Keyword Planner/Ahrefs/Semrush data (workbook yellow columns; Admin → SEO → Keyword map → Import).
- **Top keywords:** Nationwide: car insurance 74k, travel insurance 40k, auto insurance 33k, life insurance 33k, home insurance 27k, tenant insurance 15k, car insurance quotes 14k, pet insurance 14k, cheap car insurance 9.9k, super visa insurance 9.9k. Provincial: car insurance ontario 12k, car insurance alberta 4.5k, ontario auto insurance changes 2026 4.4k, home insurance ontario 3k (French Quebec terms like "assurance auto" 33k are blocked until AMF registration). City: car insurance toronto 6.6k, brampton 2.9k, calgary 2.8k, mississauga 2.4k, cheap car insurance toronto 2.3k, edmonton 2.1k, home insurance toronto 1.9k, ottawa 1.6k, scarborough 1.6k (unmapped: planned sub-area page).
- **Strongest niche gaps** (detail in STRATEGY.md §4): GTA sub-areas and second-tier GTA cities; fresh, dated, data-led city pages (Ratehub's are stale round numbers); life and living benefits outside ON/BC/AB/MB (PolicyAdvisor can't sell there); regulation explainers with calculators (Ontario accident-benefits opt-out July 2026, Alberta Care-First, ICBC); condo city pages and student-renter pages; P&C insurer head-to-heads and an Atlantic rate-decision tracker; mortgage protection at renewal; super visa by community; a staffed specialist for hard cases (high-risk drivers, declined homes, medical underwriting, newcomers, fleets).
- **15 specialist desks:** High-risk auto, Newcomer driver, Gig driver, Accident benefits review (Ontario only), Short-term rental, Cottage & rural property, Hard-to-insure property, Medical underwriting, Newcomer life, Self-employed income protection, Snowbird travel, Commercial auto & trucking, Mortgage renewal protection, Super Visa, Condo. Leads from a desk page route to an advisor tagged with that desk first, then to a licensed generalist (logged).
- **Blog plan (510 topics across 19 segments, built from the competitor research):** the workbook's last tab (and docs/blog-content-plan.csv) lists every planned post per insurance segment with title, URL, focus and secondary keywords, meta title (45–60 chars) and description (140–155), H2 outline, FAQ, value asset, required internal links, CTA, schema, word count, competitor gap, optimization and compliance instructions, priority and refresh cadence. The 18 launch guides are listed there as Published. Write priority 1 first; mark rows Writing/Published as you go.

## Content and SEO rules (always)

- One primary keyword per page: in the title tag, H1, first 100 words and slug. Secondary keywords go in H2s, FAQ and body. A 40–60 word direct answer under the first H2 (for featured snippets and AI answers).
- Titles 50–65 characters including the " | Instasure.ca" suffix (the site drops the suffix when it would overflow); descriptions 140–160.
- Every post: visible "Updated" date, sources (regulator, insurer, StatCan, IBC), a licensed reviewer, FAQ (FAQPage schema), links to its money page, and an estimate or specialist-desk CTA.
- Never invent statistics. Estimates are labelled as estimates with the example profile and date. No "best", "cheapest" or "lowest" claims without a published methodology (Competition Act, RIBO/FSRA advertising rules). Insurer reviews and head-to-heads need a published review method first.
- Say "licensed advisor", not "broker", unless the entity is a registered brokerage. Quebec stays waitlisted (no French pages, priority ≥ 3) until AMF registration.
- Canadian spelling; correct regulator per province (FSRA, AIC/Superintendent, BCFSA, ICBC, MPI, SGI, AMF, etc.).
- Publishing: Admin → Content (direct publish purges cache, updates sitemaps, pings IndexNow when enabled). Programmatic city pages stay noindex until enriched via Admin → SEO → Page overrides.

## Production (live since October 3, 2026)

- **https://instasure.ca** on the Lendmax server (159.203.33.160, Ubuntu, nginx + certbot, shared with rateshop.ca, lendmax.ca and ~20 other sites). Reach it through the Lendmax_Server MCP tools.
- systemd unit `instasure` runs `/opt/instasure/bin/node server.js` as user `instasure` on **127.0.0.1:3330** (hardened: ProtectSystem=strict, writes only to `/var/lib/instasure`).
- Code: `/srv/instasure/releases/<commit>/`, symlinked from `/srv/instasure/current` (releases: a25d077, then 19985f8 live since October 3, 2026). Data: `/var/lib/instasure/instasure.db` (SQLite WAL) and `/var/lib/instasure/uploads`. Log: `/var/log/instasure.log`. Settings and secrets: `/etc/instasure/instasure.env` (root-only; never print it into chat or commit it). Admin: https://instasure.ca/admin as admin@instasure.ca (password in that env file).
- nginx: `/etc/nginx/sites-available/instasure.ca` (http and www → https://instasure.ca, proxy to 3330). Let's Encrypt certificate for instasure.ca + www, auto-renewing (first expiry 2027-01-01). Always `nginx -t` before `systemctl reload nginx`: the reload affects every site on the server.
- **Live settings changed in the database (not in code defaults):** customer service phone `+1 877 610 6554` (links as `tel:+18776106554`); lead alerts (`notify_emails`) → `help@instasure.ca`; the four sample advisors are inactive (`active = 0`).
- **Advisor for now is an avatar:** the "Instasure Advisor Team" profile (`/advisors/instasure-advisor-team/`, brand avatar `/img/advisor-avatar.svg`, created by `scripts/team-advisor.js`) takes every lead in the 9 serviceable provinces and all product lines, and its email is help@instasure.ca, so every lead alerts help@. It has no licence on record, so it is noindex and has no Person markup (`pages.advisorListed`). When real licensed advisors are added: enter their licences, tag their desks, then run `npm run team-advisor -- --off` on the server.
- **Sitemaps and crawlers:** `/sitemap.xml` indexes one file per page type: core (40), services (45), provinces (231), cities (255), places (58), guides (25); advisors appears once a licensed advisor exists. 654 indexable URLs, truthful `lastmod`. robots.txt names every AI search and training crawler (allowed, kept out of /admin/, /api/, /quote/results/, /unsubscribe, /e/). `/llms.txt` has scope, contact and section indexes. IndexNow is enabled (`INDEXNOW_ENABLED=true`); publishing pings automatically, and `npm run indexnow:submit` resubmits everything (first submission on October 3, 2026 returned 403 SiteVerificationNotCompleted while Bing verified the key; a retry was scheduled).
- **Running a script on the server** (needs the production env and the DB owner): `cd /srv/instasure/current && set -a && . /etc/instasure/instasure.env && set +a && runuser -u instasure -- /opt/instasure/bin/node --disable-warning=ExperimentalWarning scripts/<name>.js`.
- **Deploying an update:** on the server, `git fetch --depth 1 https://github.com/NanoQode/Calculators <commit>`, `git archive FETCH_HEAD:instasure.ca | tar -x -C /srv/instasure/releases/<short>`, `npm ci --omit=dev` there (npm is at `/root/.hermes/node/bin`), repoint `/srv/instasure/current`, `systemctl restart instasure`, then crawl the sitemap on 127.0.0.1:3330. Keep the old release for rollback. Write to the database only as the `instasure` user (`runuser -u instasure -- /opt/instasure/bin/node …`) so WAL files keep the right owner, and restart afterwards (settings and pages are cached in memory).

## Still to do (owner decisions)

1. SMTP details (user will supply): add `SMTP_*` to `/etc/instasure/instasure.env` and restart. Until then every email, including lead alerts to help@instasure.ca and customer confirmations (from hello@instasure.ca), is only recorded in Admin → Email log.
2. Real licensed advisors with licence numbers, tagged to the desks they staff; then turn off the team avatar (`npm run team-advisor -- --off`) and delete the sample advisors.
3. Confirm the licensed operating entity per province and line; legal name, mailing address and privacy officer in Site settings.
4. Submit `https://instasure.ca/sitemap.xml` to Google Search Console (Google does not use IndexNow) and Bing Webmaster Tools; add the verification codes in Site settings.
5. Work through docs/CONTENT_REVIEW.md (facts to verify, estimate-model review, then set "Estimates reviewed" in Site settings).
6. Once real advisors take leads, help@ only gets hot and unassigned leads; copying help@ on every lead would be a small change in `src/lib/leads.js` `notifyTeam`.

## Working on the code

- Node ≥ 22.5 (`node:sqlite`, run with `--disable-warning=ExperimentalWarning`), Express 4, EJS (no `require` in templates: pass locals), Tailwind v3 compiled to `public/assets/site.css` (`npm run build:css` after template class changes, and commit the CSS). Helmet CSP with nonces: no inline scripts without the nonce.
- `npm test` (34 tests, temporary DB) must pass before every push. `npm run seed` is idempotent and maps stored keywords to newly built pages without overwriting admin edits.
- Develop on branch `claude/instasure-competitive-analysis-pmf7wk` (repo NanoQode/Calculators). Don't create a PR unless asked.
- Mid-sentence product names use the `lc()` view helper (keeps "Super Visa", "E&O", "RV", "HVAC" capitalised).

---

@docs/STRATEGY.md

@docs/SITE_REVIEW.md

@docs/CONTENT_REVIEW.md
