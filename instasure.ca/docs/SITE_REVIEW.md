# Competitor site review (direct crawl, October 2026)

This review adds direct page data to the search-based research in [`STRATEGY.md`](STRATEGY.md). It covers each competitor's robots.txt, complete XML sitemaps, llms.txt and the on-page metadata of 51 sample pages. The strategy and keyword map have been updated to match; the changes are summarised in section 8.

**How it was done.** This build's container blocks the competitor domains, so the pages were fetched from a separate remote sandbox, with a normal browser user agent and no attempt to get around bot protection.
- **Fetched in full:** Ratehub, PolicyAdvisor and Sonnet. That covers robots.txt, every XML sitemap (9,009 URLs), llms.txt and 51 pages (22 Ratehub, 16 PolicyAdvisor, 13 Sonnet).
- **Blocked:** Rates.ca, Sun Life and Manulife answered HTTP 403 to automated requests. For these:
  - Rates.ca: its robots.txt and llms.txt were readable, and search results fill the rest.
  - Sun Life and Manulife: search results only.

---

## 1. Scorecard

| | Ratehub | PolicyAdvisor | Sonnet | Rates.ca | Sun Life | Manulife |
|---|---|---|---|---|---|---|
| Fetched directly | Yes | Yes | Yes | robots.txt and llms.txt only | No (403) | No (403) |
| URLs in sitemaps | 6,229 (312 insurance pages, 3,455 blog posts across all topics) | 617 (245 life, 62 group benefits, 48 insurer reviews, 41 health, 39 visitor) | 2,163 EN+FR (464 FAQ pages, 437 EN and 495 FR blog posts, 48 English product and geo pages) | not available (sitemap 403) | not available | not available |
| Province pages | Car: all 13. Home: 13. Life: 10. Tenant: 4 | Life: ON, BC, AB, MB (plus "-advisor" twins). Health: ON, BC, AB, MB | Auto: ON, QC, NS, NB, PE. Home: AB, BC, ON, QC, NS, NB | Car: ON, AB, BC, QC. Home: ON, AB, BC | none seen | none seen |
| City pages | Car 40, home 18, life 6, tenant 3 | Life 9 (one more listed but 404) | Auto 9, home 6, tenant 10, condo 3 | Car 34+ (ON-heavy), home 10, condo 5, tenant 6 | Advisor microsites instead | none seen |
| Framework / HTML size | Next.js, 330–560 KB, about 280–330 links per page | WordPress, 220–410 KB | dotCMS, 110–250 KB | Drupal | n/a | n/a |
| Structured data on money pages | WebPage, Article (author), FAQPage, BreadcrumbList | InsuranceAgency on every page. Article, author and **reviewedBy** on guides. Product + AggregateRating on some | Product + AggregateRating + Review (own customer reviews). No breadcrumbs on EN pages | n/a | n/a | n/a |
| Authorship | One named author (VP of Insurance) on every money page; no reviewer | "Written by" and "Reviewed by" (CEO, LLQP) on guides; author pages with credential markup | Person names in review markup; blog by "Sonnet Insurance" | n/a | n/a | n/a |
| Freshness | 58 of 184 car, home, life and tenant pages have sitemap dates in 2023–2024. Several city pages last modified May 2025 | 94 of 245 life pages have sitemap dates in 2019–2023. City titles say "(2025)" | Every sitemap date is 2026 (looks generated, not edited) | Year-stamped titles | n/a | n/a |
| llms.txt | Yes (mortgage-focused, lists 5 insurance URLs) | No (404) | Yes (non-standard AI directives) | Yes (clear scope statement, lists research and trackers) | n/a | n/a |
| AI crawlers in robots.txt | No AI-specific rules (all allowed) | No AI-specific rules | No AI-specific rules | No AI-specific rules | n/a | n/a |

---

## 2. What the direct crawl corrected

The search-based research undercounted several competitors, because only pages that surfaced in results were recorded:

1. **Ratehub has life pages for 6 cities and 10 provinces**, plus critical illness, disability, mortgage life, final expense, no-medical, senior, smoker and super visa pages, and French life pages (`/assurance/vie/…`). Search had found none of these.
2. **Ratehub's car city layer is 40 cities**, including Atlantic and Prairie cities (Fort McMurray, Grande Prairie, Medicine Hat, Kelowna, Abbotsford, Victoria). It has no pages for Vaughan, Richmond Hill, Milton, Pickering, Ajax, Whitby, Scarborough, North York or Etobicoke.
3. **PolicyAdvisor runs 15 programmatic term-life head-to-heads** (`/life-insurance/compare/term-life/{a}-vs-{b}/`), standalone life and critical illness calculators, a CDCP-vs-private-dental page, and life city pages for Windsor and Edmonton too.
4. **Rates.ca says in its llms.txt that it does not offer life, health or travel insurance.** It is not a life competitor.
5. **Rates.ca already publishes quarterly Ontario and Alberta car rate trackers by insurer**, built on FSRA and Alberta Insurance Rate Board filings. A rate-filing tracker is therefore not open for those two provinces.
6. **Sonnet now sells landlord and pet insurance**, and has 464 standalone FAQ pages (many are short answers to "is X mandatory in {province}" questions).
7. **Sun Life and Manulife publish no province or city pages.** Sun Life's local presence is advisor microsites (`advisor.sunlife.ca/{advisor}/`). Manulife has duplicate product paths indexed (`/personal/insurance/our-products/…` and `/personal/insurance/…`).

---

## 3. Metadata patterns, verbatim

| Page type | Ratehub | PolicyAdvisor | Sonnet |
|---|---|---|---|
| Car city title | "Compare Brampton Car Insurance Quotes & Save Today \| Ratehub.ca" (64 chars). Toronto: "Compare Cheap Toronto Auto Insurance Quotes Online \| Ratehub.ca" | n/a | "Car Insurance in Toronto: Quote and Buy Online \| Sonnet Insurance" (65). Mississauga: "Car Insurance in Mississauga \| Get Online Auto Insurance Quotes \| Sonnet Insurance" (82, truncated in results) |
| Car city H1 | "Compare the best Brampton car insurance quotes & save today" | n/a | "Car insurance in Toronto: Protect your vehicle" |
| Car city description | "Learn all you need to know about Brampton car insurance and compare quotes from Canada's top providers in minutes – free of charge." | n/a | "Discover the best car insurance rates in Toronto with Sonnet. Get free, personalized auto insurance quotes and buy online today." |
| Life province title | "Compare Quotes for Life Insurance in Ontario \| Ratehub.ca" | "Best Life Insurance in Ontario (2026)" | n/a |
| Life province description | "Looking for life insurance in Ontario? We can help – compare quotes from the province's top providers with us today." | "Life insurance in Ontario starts at $22/month. Compare term life and whole life insurance quotes from the best Canadian insurers in minutes." | n/a |
| Life city title | "Compare Life Insurance Quotes in Toronto \| Ratehub.ca" | "Best Life Insurance in Toronto (2025) \| PolicyAdvisor" | n/a |
| Cost guide title | "How much is car insurance in Brampton? \| Ratehub.ca" | "Life insurance cost in Canada in 2026 \| PolicyAdvisor"; "Cost of critical illness insurance in Canada (2025) \| PolicyAdvisor" | "What's the average price of car insurance in Quebec? (2026) \| Sonnet Insurance" |
| Head-to-head | n/a | "Sun Life vs. Manulife Term Life Insurance (2026)" / H1 "…: Which is better in 2026?" | n/a |
| FAQ page | n/a | n/a | "Is home insurance mandatory in Ontario? \| Sonnet Insurance" (description is the whole 1,000-character answer) |
| French city | n/a | n/a | "Assurance auto Montréal : Soumission 100% en ligne \| Sonnet" |

**Patterns:**
- Ratehub leads with "Compare … Quotes & Save Today".
- PolicyAdvisor leads with "Best …" plus a year, and puts a price anchor in the description ("starts at $22/month").
- Sonnet leads with "{Product} in {City}: Quote and Buy Online".
- Nobody uses the province abbreviation in city titles. instasure.ca's "Car Insurance Brampton, ON: Compare Quotes & Costs (2026)" is shorter than all three, matches both the "compare" and "how much" intents, and avoids "best" and "cheap" claims.

---

## 4. Content and data on the page

| Signal | Ratehub | PolicyAdvisor | Sonnet | instasure.ca (before this review) |
|---|---|---|---|---|
| Words on a city money page | 1,450–1,900 | 1,500 (Toronto life) | 1,750–4,050 | 1,150–1,330 |
| Data tables | 1–3 ("Recent quotes" by age, vehicle and insurer; coverage by province) | 1–16 (age × sex premiums; carrier rate tables) | 0 on city pages (one "average/month at Sonnet" figure) | 0 |
| Price anchor | "Our Brampton users… $571/month"; "average… about $2,500 per year" | "$22/month"; "$26.50–$56.50 per month" | "$241/month is the average cost of car insurance in Toronto at Sonnet" | Example range, e.g. "$212–$329/mo" with a stated profile |
| Consistency | **Conflicting Brampton figures:** about $2,500/yr (city page), $1,957/yr (blog), $571/mo (Ontario page) | City page shows a 2025 year in a 2026 page | One first-party figure per page | One modelled range per page, with the profile and date |
| Provincial context | FSRA and CHLIA statistics with dates | CHLIA statistics; OHIP coverage explainers | Repair-cost statistic | Regulator, auto system, minimum liability, FSRA average (dated) |

**What gets quoted in AI answers** (from the Google May 2026 guidance and citation studies in `STRATEGY.md`): dated figures in the first sentences and tables with clear row and column labels. PolicyAdvisor's age × sex premium tables and Ratehub's "recent quotes" tables are exactly that format.

---

## 5. Technical and on-page issues we can exploit

**Ratehub**
- `/insurance/car` (the hub) has a canonical tag pointing at a different URL, `/insurance/best-car-insurance-quote`. Two URLs compete for "car insurance quotes".
- City pages declare only an `x-default` hreflang, with no `en-CA` entry, even where French twins exist.
- Home-insurance titles contain a double-escaped ampersand (`&amp;amp;` in the HTML), so results show "Quotes &amp; Save Today".
- One author on every money page and no reviewer, so expertise rests on a single name.
- 31% of car, home, life and tenant pages carry sitemap dates from 2023–2024. The Brampton, Calgary and Halifax car pages were last modified in May 2025.
- About 300 links per page (mega-menu) and 330–560 KB of HTML dilute internal link signals.

**PolicyAdvisor**
- The sitemap lists `/life-insurance/alberta/calgary/`, which returns 404.
- The super visa cost page (`/visitor-insurance-canada/super-visa-insurance-cost-in-canada/`) has a canonical tag pointing into a different section (`/employee-benefits/…`), and the page has invalid JSON-LD.
- City and province pages have no Article, author or date markup (guides do), and city titles still say "(2025)". The critical illness cost guide title also says "(2025)".
- robots.txt rules `Disallow: /*p=*` and `Disallow: /*keyword*` match far more URLs than intended (any URL containing "p=" or "keyword").
- 94 of 245 life pages (38%) have sitemap dates from 2019–2023.
- Licensed only in ON, BC, AB and MB.

**Sonnet**
- robots.txt lists its sitemaps on bare lines without the `Sitemap:` prefix, so crawlers reading robots.txt don't find them.
- English money pages have no BreadcrumbList and no `og:image`. The homepage has two H1s.
- Template H2s repeat on every page ("What type of insurance do you need?" ×3, "Are you a Sonnet customer?"), which muddies the heading outline.
- Self-serving Product + AggregateRating markup for its own reviews (Google does not show stars for this).
- A thin city layer (9 auto cities). FAQ pages are short, with descriptions of 1,000+ characters.

**Rates.ca, from search results:** generic titles with no city on some pages, an indexed `?cta=` URL, and inconsistent driver profiles between pages (see `STRATEGY.md`).

instasure.ca was checked against each of these: one canonical per page, consistent titles, an `og:image` on every page and a breadcrumb on every page below the home page, one H1, a valid `Sitemap:` line in robots.txt, and JSON-LD that the test suite parses on every main page type.

---

## 6. Trust and freshness bar

- **To match PolicyAdvisor:** a visible "Written by" and "Reviewed by" (a licensed person) on advice content, `reviewedBy` in the JSON-LD, and author pages with credential markup. instasure.ca's guides already support this; the reviewer slot stays empty until a real licensed advisor is set (see `CONTENT_REVIEW.md`).
- **To beat everyone:** dates on the money pages themselves. None of the three shows a reliable "updated" date on city pages, and PolicyAdvisor shows a stale year.

---

## 7. AI crawler readiness

- All four readable robots.txt files allow AI crawlers by default. At least three competitors publish llms.txt (Ratehub, Sonnet, Rates.ca); PolicyAdvisor does not, and Sun Life and Manulife could not be checked.
- **Rates.ca's llms.txt is the best model.** It states what the company does **not** offer, links "How we make money" and "Editorial policy", and lists its original research.
- instasure.ca already served llms.txt and llms-full.txt; this review added an explicit scope section (what we do and don't do, provinces with advisor service vs information only, and the data review date).

---

## 8. Changes made to instasure.ca after this review

**In the build**
1. **Example estimate tables** on every product × province and product × city page, matching the table format competitors use and AI answers quote:
   - life and living benefits: age × female/male
   - car: driver profiles, including a claim and a ticket
   - home, condo and tenant: coverage levels
   - super visa: visitor age
   - business: business type, revenue or team size

   Each table states its assumptions and "as of" date, and labels the values as modelled estimates.
2. **Truthful dates.** Product, province, city and hub pages now show "Updated {date}" and carry `dateModified` in JSON-LD. Sitemap `lastmod` comes from the date the estimates and local data were last reviewed (a new Site settings field) or the page's latest editor change, never "today" by default. The estimate "as of" month follows the same setting instead of rolling forward every month.
3. **llms.txt scope section** (what we offer, what we don't, where advisors serve, the data review date).
4. **Copy fixes:** car, home and business product text no longer says "licensed broker… your lowest rate". It now says "licensed advisor… compare insurers", in line with our own advertising rules.
5. **Product-appropriate local content,** found while checking our pages against competitors':
   - Life, health and travel pages no longer show P&C "local risk factors" (car theft, basement flooding). They now explain that these products are priced on the person, not the postal code.
   - An internal SEO note was removed from the "What's changing" box on every Quebec page.
   - Meta descriptions for waitlisted provinces no longer promise "advisors licensed in" that province.
   - Car pages no longer repeat the accident-benefits change or show the mortgage-renewal note.

**In the keyword map** (`src/data/keywords.js`, regenerated into `KEYWORDS.md`)
- Competitor coverage for Ratehub, PolicyAdvisor and Sonnet now comes from their complete sitemaps rather than search samples.
- Thin and stale competitor city pages (PolicyAdvisor's "(2025)" titles, Ratehub's thin life city pages) are flagged as freshness openings, which raises those keywords' priority.
- "sun life vs manulife" was lowered from P3 to P4, because PolicyAdvisor already runs 15 such pages.
- **P&C insurer head-to-heads were added** ("intact vs aviva", "td insurance vs intact" and others). No competitor publishes them.
- **Atlantic rate-change keywords were added** ("nova scotia car insurance rate increase" and others). Rates.ca's trackers cover only Ontario and Alberta.

**In the strategy** (`STRATEGY.md`): the competitor table, correlation map, data assets and roadmap now reflect the corrections in section 2.

---

## 9. Limits

- Sun Life and Manulife pages, and Rates.ca pages and sitemap, could not be fetched (HTTP 403 bot protection). Their entries rely on search results and Rates.ca's llms.txt.
- The 51-page sample covers the main template of each page type, not every page.
- Sitemap dates show what each site declares, not when content actually changed.
- Word counts exclude navigation, header and footer, so they are approximate.
- Direct fetching from this build's own container is still blocked. To let future sessions fetch competitor pages directly, add the domains under **Network access → Custom → Allowed domains** in the cloud environment settings (see https://code.claude.com/docs/en/cloud-environments#network-access).
